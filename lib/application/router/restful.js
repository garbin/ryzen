const compose = require('koa-compose')
const { Model } = require('objection')
const assert = require('assert')
const { middleware: paginate } = require('koa-pagination')
const convert = require('koa-convert')
const _ = require('lodash')
const pluralize = require('pluralize')
const Base = require('./base')

module.exports = class RESTful extends Base {
  constructor (model, options) {
    super(options)
    assert(model instanceof Model, 'model should be instanceof Objection Model')
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

  list () {
    const { middlewares, options } = this.parseArgs(arguments, {
      joins: [],
      sortable: [],
      searchable: [],
      filterable: [],
      pagination: undefined,
      fetch: {}
    })
    this.get(this.resourceRootPath, convert(paginate(options.pagination)), compose(middlewares),
      async (ctx) => {
        const query = ctx.state.query || this.query(ctx)
        const { filters, q: keywords, sort: orderBy = _.first(options.sortable) } = ctx.request.query
        query.query(q => {
          if (query.relatedData) {
            const foreignKey = query.relatedData.key('foreignKey')
            const parentId = query.relatedData.parentId
            q.where({ [foreignKey]: parentId })
          }
          if (!_.isEmpty(filters) && options.filterable) {
            const filter = field => {
              if (filters[field]) {
                q.where({ [field]: filters[field] })
              }
            }
            let filterable = options.filterable
            if (_.isArray(options.filterable)) {
              filterable = () => options.filterable.map(filter)
            }
            filterable({ filter, query: q, filters })
          }
          if (keywords && options.searchable) {
            q.where(function () {
              const like = ['pg', 'postgres'].includes(q.client.config.client)
                ? 'ILIKE' : 'LIKE'
              options.searchable.forEach((field, index) => {
                this[index ? 'orWhere' : 'where'](field, like, `%${keywords}%`)
              })
            })
          }
        })
        if (options.sortable) {
          if (_.includes(options.sortable, _.trimStart(orderBy, '-'))) {
            query.orderBy(orderBy, orderBy[0] === '-' ? 'DESC' : 'ASC')
          }
        }
        ctx.resources = await query.fetchPage(Object.assign({}, ctx.pagination, options.fetch))
        ctx.body = ctx.resources.models
        ctx.pagination.length = ctx.resources.pagination.rowCount
      }
    )
    return this
  }
  item () {
    const { middlewares, options } = this.parseArgs(arguments, {
      fetch: {}
    })
    this.get(this.itemRoute, compose(middlewares), async (ctx) => {
      const query = ctx.state.query || this.collection(ctx)
      ctx.body = await query.query({
        where: {
          [this.idAttribute]: ctx.params[this.idAttribute]
        } }).fetchOne(Object.assign({ require: true }, options.fetch))
    })
    return this
  }

  read () {
    const { middlewares, options } = this.parseArgs(arguments, {
      list: {},
      item: {}
    })
    return this
      .list(...middlewares, options.list)
      .item(...middlewares, options.item)
  }
  update () {
    const { middlewares, options } = this.parseArgs(arguments)
    const update = async (ctx) => {
      const attributes = ctx.state.attributes || ctx.request.body
      const query = ctx.state.query || this.collection(ctx)
      ctx.state.resource = await query.query({
        where: {
          [this.idAttribute]: ctx.params[this.idAttribute]
        } }).fetchOne({ require: true })
      await ctx.state.resource.save(
        attributes,
        Object.assign({ patch: true }, options.save, ctx.state.options))
      if (options.after) await options.after(ctx)
      ctx.body = ctx.state.resource
      ctx.status = 202
    }
    this.put(this.itemRoute, compose(middlewares), update)
    this.patch(this.itemRoute, compose(middlewares), update)

    return this
  }
  destroy () {
    const { middlewares, options } = this.parseArgs(arguments)
    this.methods.destroy = true

    this.del(this.itemRoute, compose(middlewares), async (ctx) => {
      const query = ctx.state.query || this.collection(ctx)
      ctx.state.resource = await query.query({
        where: {
          [this.idAttribute]: ctx.params[this.idAttribute]
        } }).fetchOne({ require: true })
      ctx.state.deleted = ctx.state.resource.toJSON()
      await ctx.state.resource.destroy(Object.assign({}, options.destroy, ctx.state.options))
      if (options.after) await options.after(ctx)
      ctx.status = 204
    })
    return this
  }
  crud () {
    return this.create().read().update().destroy()
  }
  setup () {
    this.crud()
  }
  children (...children) {
    this.use(
      `${this.listRoute}/:${this.foreignId}(${this.idType})`,
      async (ctx, next) => {
        ctx.state.nested = ctx.state.nested || {}
        ctx.state.nested[this.name] = await this.collection(ctx).query(q =>
          q.where({ [this.idAttribute]: ctx.params[this.foreignId] })
        ).fetchOne({ require: true })
        await next()
      },
      ...children.map(Child => Child instanceof Base
        ? Child.routes()
        : Child.prototype instanceof Base
          ? new Child().routes()
          : Child)
    )
    return this
  }
}
