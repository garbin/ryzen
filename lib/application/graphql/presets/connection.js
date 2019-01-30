const types = require('../types')
const { isEmpty, isArray, isFunction, trimStart, includes } = require('lodash')
const relay = require('../relay')
const { cursor2page } = require('../../../utils')

module.exports = {
  args (args) {
    return Object.assign({
      keyword: types.string(),
      orderBy: types.string(),
      filterBy: types.json()
    }, args)
  },
  resolve (options) {
    const {
      // collection = ctx => options.model.collection(),
      query = ctx => options.model.query(),
      searchable = [],
      sortable = [],
      filterable = [],
      cursor,
      limit = 10
    } = options || {}
    return async (model, { first = limit, after, keyword, orderBy, filterBy = {} }, ctx, info) => {
      const { query: fetch = query(ctx, model) } = ctx
      let result = fetch.where(builder => {
        if (!isEmpty(filterBy) && filterable.length) {
          const filter = field => {
            if (filterBy[field]) {
              if (!isFunction(field)) {
                builder.where({ [field]: filterBy[field] })
              } else {
                field({ filterBy, query: builder })
              }
            }
          }
          const applyFilters = isArray(filterable)
            ? () => filterable.forEach(filter)
            : filterable
          applyFilters({ filter, query: builder, filterBy })
        }
        if (searchable.length && keyword) {
          const knex = model.knex()
          builder.where(function () {
            const like = ['pg', 'postgres'].includes(knex.client.config.client)
              ? 'ILIKE' : 'LIKE'
            searchable.forEach((field, index) => index
              ? this.orWhere(field, like, `%${keyword}%`)
              : this.where(field, like, `%${keyword}%`))
          })
        }
      })
      if (sortable.length) {
        let orderByField = sortable[0]
        let orderByDirection = 'DESC'
        const orderByTrimed = trimStart(orderBy, '-')
        if (orderBy && includes(sortable, orderByTrimed)) {
          orderByField = orderBy.trimLeft('-')
          orderByDirection = orderBy[0] === '-' ? 'DESC' : 'ASC'
        }
        result.orderBy(orderByField, orderByDirection)
      }
      result = await result.page(...cursor2page(after, first))
      return relay.connection.result(result.results, {
        total: result.total,
        after,
        first
      }, cursor)
    }
  }
}
