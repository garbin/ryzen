const compose = require('koa-compose')
const { compact, isFunction, isEmpty, defaults, first, includes, trimStart } = require('lodash')
const { Model } = require('objection')
const assert = require('assert')
const { middleware: paginate } = require('koa-pagination')
const convert = require('koa-convert')
const httpErrors = require('http-errors')
const pluralize = require('pluralize')
const Router = require('koa-router')

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
  }

  create () {
    const { middlewares } = this.parseArgs(arguments)
    // create
    this.post(this.resourceRootPath, compose(middlewares), async (ctx) => {
      const attributes = ctx.state.attributes || ctx.request.body
      ctx.state.item = await this.query(ctx).insert(attributes)
      ctx.body = ctx.state.item
      ctx.status = 201
    })
    return this
  }

  get read () {
    const read = () => {
      const { middlewares, options = {} } = this.parseArgs(arguments, {
        list: {},
        item: {}
      })
      read.list(...middlewares, options.list)
      read.item(...middlewares, options.item)
      return this
    }
    read.list = () => {
      const { middlewares, options } = this.parseArgs(arguments, {
        joins: [],
        sortable: [],
        searchable: [],
        filterable: [],
        pagination: undefined,
        fetch: {}
      })
      this.get(this.resourceRootPath, convert(paginate(options.pagination)), compose(middlewares),
        async ctx => {
          const query = ctx.state.query || this.query(ctx)
          const { filters, q: keywords, sort: orderBy = first(options.sortable) } = ctx.request.query
          const result = await query.where(builder => {
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
              builder.where(function () {
                const like = ['pg', 'postgres'].includes(Model.knex().config.client)
                  ? 'ILIKE' : 'LIKE'
                options.searchable.forEach((field, index) => {
                  this[index ? 'orWhere' : 'where'](field, like, `%${keywords}%`)
                })
              })
            }
            if (options.sortable) {
              if (includes(options.sortable, trimStart(orderBy, '-'))) {
                builder.orderBy(orderBy, orderBy[0] === '-' ? 'DESC' : 'ASC')
              }
            }
            return builder
          }).page(Math.floor(ctx.pagination.offset / ctx.pagination.limit), ctx.pagination.limit)
          ctx.state.items = result.results
          ctx.pagination.length = result.total
          ctx.body = ctx.state.items
        }
      )
      return this
    }
    read.item = () => {
      const { middlewares } = this.parseArgs(arguments)
      this.get(this.resourceItemPath, compose(middlewares), async (ctx) => {
        const query = ctx.state.query || this.query(ctx)
        ctx.body = await query.findOne({
          [this.idColumn]: ctx.params[this.idColumn]
        })
      })
      return this
    }
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
      const result = ctx.state.item.$query().updateAndFetch(attributes)
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
  children (...children) {
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
      ...children.map(child => compose([child.routes(), child.allowedMethods()]))
    )
    return this
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
}

module.exports = {
  restful (model, setup) {
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
