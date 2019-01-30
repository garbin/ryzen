const compose = require('koa-compose')
const { compact, isFunction, isEmpty, defaults, first, includes, trimStart, last } = require('lodash')
const { Model } = require('objection')
const assert = require('assert')
const { middleware: paginate } = require('koa-pagination')
const convert = require('koa-convert')
const httpErrors = require('http-errors')
const pluralize = require('pluralize')
const Router = require('koa-router')
const { cursor2page } = require('../utils')

class RESTfulRouter extends Router {
  constructor (model, options = {}) {
    super(options)
    assert(model.prototype instanceof Model, 'model should be instanceof Objection Model')
    assert(!Array.isArray(model.idColumn), 'Composite key model is not supported currently')
    this.model = model
    this.resourceRootName = options.resourceRootName || model.tableName
    this.singularName = options.singularName || pluralize.singular(model.tableName)
    this.idColumn = options.idColumn || model.idColumn
    this.idType = options.idType || '\\d+'
    this.foreignIdColumn = options.foreignIdColumn || `${this.singularName}_id`
    this.resourceRootPath = options.resourceRootPath || `/${this.resourceRootName}`
    this.resourceItemPath = options.resourceItemPath || `/${this.resourceRootName}/:${this.idColumn}`
    this.query = options.query || (ctx => model.query())

    // relation with other router
    this.children = {}
    this.parent = options.parent
  }

  parseArgs (oriArgs, optionDefaults = {}) {
    const args = Array.prototype.slice.call(oriArgs)
    const none = async (ctx, next) => { await next() }
    let options = args.pop()
    let middlewares = args
    middlewares = compact(middlewares)
    if (isFunction(options)) {
      middlewares = middlewares.concat(options)
      options = {}
    }
    middlewares = isEmpty(middlewares) ? [none] : middlewares
    options = defaults(options, optionDefaults)
    return { middlewares, options }
  }
  crud () {
    return this.create().read().update().destroy()
  }
  create () {
    const { middlewares } = this.parseArgs(arguments)
    // create
    this.post(this.resourceRootPath, compose(middlewares), async (ctx) => {
      const query = ctx.state.query || this.query(ctx)
      const attributes = ctx.state.attributes || ctx.request.body
      ctx.state.item = await query.insert(attributes)
      ctx.body = ctx.state.item
      ctx.status = 201
    })
    return this
  }

  get read () {
    // combine
    const read = function () {
      const { middlewares, options = {} } = this.parseArgs(arguments, {
        list: {},
        item: {}
      })
      read.list(...middlewares, options)
      read.item(...middlewares)
      return this
    }.bind(this)

    // list
    read.list = function () {
      const { middlewares, options } = this.parseArgs(arguments, {
        join: null,
        sortable: [],
        searchable: [],
        filterable: [],
        pagination: undefined
      })
      this.get(this.resourceRootPath, convert(paginate(options.pagination)), compose(middlewares),
        async ctx => {
          let query = ctx.state.query || this.query(ctx)
          const { filters, q: keywords, sort: orderBy = first(options.sortable) } = ctx.request.query
          query = options.join ? query.leftJoinRelation(options.join) : query
          query = query.where(builder => {
            if (!isEmpty(filters) && options.filterable) {
              const filter = field => {
                if (filters[field]) {
                  builder.where({ [field]: filters[field] })
                }
              }
              let filterable = options.filterable
              if (Array.isArray(options.filterable)) {
                filterable = () => options.filterable.map(filter)
              }
              filterable({ filter, query: builder, filters })
            }
            if (keywords && options.searchable) {
              const knex = this.model.knex()
              builder.where(function () {
                const like = ['pg', 'postgres'].includes(knex.client.config.client)
                  ? 'ILIKE' : 'LIKE'
                options.searchable.forEach((field, index) => {
                  this[index ? 'orWhere' : 'where'](field, like, `%${keywords}%`)
                })
              })
            }
            return builder
          })

          if (options.sortable.length) {
            let orderByField = options.sortable[0]
            let orderByDirection = 'DESC'
            const orderByTrimed = trimStart(orderBy, '-')
            if (orderBy && includes(options.sortable, orderByTrimed)) {
              orderByField = orderByTrimed
              orderByDirection = orderBy[0] === '-' ? 'DESC' : 'ASC'
            }
            query = query.orderBy(orderByField, orderByDirection)
          }
          const result = await query.page(...cursor2page(ctx.pagination.offset, ctx.pagination.limit))
          ctx.state.items = result.results
          ctx.pagination.length = result.total
          ctx.body = ctx.state.items
        }
      )
      return this
    }.bind(this)

    // item
    read.item = function () {
      const { middlewares } = this.parseArgs(arguments)
      this.get(this.resourceItemPath, compose(middlewares), async (ctx) => {
        const query = ctx.state.query || this.query(ctx)
        ctx.body = await query.findOne({
          [this.idColumn]: ctx.params[this.idColumn]
        })
      })
      return this
    }.bind(this)
    return read
  }

  update () {
    const { middlewares, options = { patch: true } } = this.parseArgs(arguments)
    const update = async (ctx) => {
      const attributes = ctx.state.attributes || ctx.request.body
      const query = ctx.state.query || this.query(ctx)
      const where = { [this.idColumn]: ctx.params[this.idColumn] }
      const item = await query.findOne(where)
      assert(item instanceof this.model, new httpErrors.NotFound(`Item ${this.idColumn} = ${ctx.params[this.idColumn]} can not be found`))
      const result = await item.$query().patchAndFetch(attributes)
      if (options.after) await options.after(ctx)
      ctx.body = result
      ctx.status = 202
    }
    this.put(this.resourceItemPath, compose(middlewares), update)
    this.patch(this.resourceItemPath, compose(middlewares), update)

    return this
  }
  destroy () {
    const { middlewares, options = {} } = this.parseArgs(arguments)

    this.del(this.resourceItemPath, compose(middlewares), async (ctx) => {
      const query = ctx.state.query || this.query(ctx)
      const where = { [this.idColumn]: ctx.params[this.idColumn] }
      const item = await query.findOne(where)
      assert(item instanceof Model, new httpErrors.NotFound(`Item ${this.idColumn} = ${ctx.params[this.idColumn]} can not be found`))
      ctx.state.deleted = item
      await item.$query().delete()
      if (options.after) await options.after(ctx)
      ctx.status = 204
    })
    return this
  }
  child (...args) {
    this.nested(...args)
    return this
  }
  nested (model, setup = router => router.crud(), id) {
    const child = new RESTfulRouter(model, { parent: this })
    child.use(async (ctx, next) => {
      const relation = this.model.findRelation(child.model, [
        Model.HasManyRelation, Model.HasOneRelation, Model.ManyToManyRelation
      ])
      assert(relation.name, new httpErrors.InternalServerError(`Relation not found`))
      ctx.state.query = last(ctx.state.nested).$relatedQuery(relation.name)
      await next()
    })
    setup(child)
    this.children[id || model.tableName] = child
    this.use(
      `${this.resourceRootPath}/:${this.foreignIdColumn}(${this.idType})`,
      async (ctx, next) => {
        ctx.state.nested = ctx.state.nested || []
        const parent = await this.query(ctx).findOne({
          [this.idColumn]: ctx.params[this.foreignIdColumn]
        })
        ctx.state.nested.push(parent)
        await next()
      },
      child.routes(),
      child.allowedMethods()
    )
    return child
  }
}

module.exports = {
  restful (model, setup = router => router.crud()) {
    assert(model.prototype instanceof Model, 'restful model should be an instance of Objection.Model')
    assert(setup instanceof Function, 'router setup should be a function')
    const router = new RESTfulRouter(model)
    setup(router)
    return router
  },
  create (setup) {
    const router = new Router()
    setup(router)
    return router
  },
  RESTfulRouter
}
