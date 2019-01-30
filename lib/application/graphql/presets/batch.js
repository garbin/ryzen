const pluralize = require('pluralize')
const { Model } = require('objection')

const batch = module.exports = {
  load (options) {
    return async (root, args, ctx, info) => {
      const {
        getLoader = ctx => ctx.loader,
        name,
        assemble,
        fetch } = options
      const loader = getLoader(ctx)
      const data = await loader.acquire(name, parents =>
        fetch(parents).then(items => assemble(items, parents))
      ).load(root)
      return data
    }
  },
  fetch (options = {}) {
    return async (root, args, ctx, info) => {
      const {
        parent = root.constructor,
        parentForeignKey = 'id',
        foreignKey = `${pluralize.singular(root.constructor.tableName)}_id`,
        mappingKey = pluralize.singular(root.constructor.tableName),
        query = q => q,
        list = true,
        model
      } = options
      const attrName = options.attrName || foreignKey
      const items = await batch.load(Object.assign({}, options, {
        name: `${parent.name}-${model.name}`,
        async fetch (parents) {
          const items = await model.query().where(builder => {
            builder.whereIn(foreignKey, parents.map(parent => parent.get(parentForeignKey)))
            return query(builder, { root, args, ctx, info })
          })
          return items
        },
        assemble (children, parents) {
          return parents.map(parent => {
            if (list) {
              return children.filter(child => {
                if (child[attrName] === parent[parentForeignKey]) {
                  child[mappingKey] = child
                  return true
                }
                return false
              })
            } else {
              return children.find(child => child[attrName] === parent[parentForeignKey])
            }
          })
        }
      }))(root, args, ctx, info)
      return items
    }
  },
  hasMany (model, options) {
    return batch.fetch(Object.assign({ list: true, model }, options))
  },
  belongsToMany (options) {
    return async (root, args, ctx, info) => {
      const selfModel = root.constructor
      const relationName = options.relation
      const relation = selfModel.relations[relationName]
      const items = await batch.load({
        async fetch (parents) {
          const reverseRelation = relation.modelClass.findRelation(selfModel, [Model.ManyToManyRelation])
          const children = await relation.modelClass.query().leftJoinRelation(reverseRelation.name).whereIn(relation.join.to, parents.map(parent => parent.id))
          return children
        },
        assemble (children, parents) {
          return parents.map(parent => children.filter(child => child[relation.foreignKey] === parent.id))
        }
      })(root, args, ctx, info)
      return items
    }
  },
  hasOne (model, options) {
    return batch.fetch(Object.assign({ model, list: false }, options))
  },
  belongsTo (model, options = {}) {
    return async (root, args, ctx, info) => {
      const { parent = root.constructor } = options
      const fk = options.parentKey || `${pluralize.singular(model.tableName)}_id`
      const items = await batch.load({
        name: `${parent.name}-${model.name}`,
        async fetch (parents) {
          const items = await model.query().whereIn(model.idColumn, parents.map(parent => parent[fk]))
          return items
        },
        assemble (items, parents) {
          return parents.map(parent =>
            items.find(item => item.id === parent[fk]))
        }
      })(root, args, ctx, info)
      return items
    }
  }
}
