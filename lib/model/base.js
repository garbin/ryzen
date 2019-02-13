const { Model } = require('objection')
const { first, last, isEmpty, toPairs } = require('lodash')
const assert = require('assert')
const Validator = require('./validator')
const { singular } = require('pluralize')

function foreignIdColumnName (tableName) {
  return `${singular(tableName)}_id`
}

module.exports = class extends Model {
  $beforeInsert () {
    super.$beforeInsert()
    const timestamps = this.constructor.timestamps === true ? ['created_at', 'updated_at'] : this.constructor.timestamps
    if (timestamps) {
      const now = new Date()
      this[first(timestamps)] = now
      this[last(timestamps)] = now
    }
  }

  $beforeUpdate () {
    super.$beforeUpdate()
    const timestamps = this.constructor.timestamps === true ? ['created_at', 'updated_at'] : this.constructor.timestamps
    if (timestamps) {
      this[last(timestamps)] = new Date()
    }
  }
  static get timestamps () {
    return true
  }
  // static get validator () {}
  // static get relations () {}
  static get relationMappings () {
    return this.relations
  }
  static findRelation (child, types) {
    try {
      types = Array.isArray(types) ? types : [types]
      const [name, info] = toPairs(this.relations).find(([relationName, relationInfo]) => {
        return (relationInfo.modelClass === child &&
        types.includes(relationInfo.relation)
        )
      })
      return { name, info }
    } catch (e) {
      throw new Error(`Relation ${child} can not be found`)
    }
  }

  static async upsert (where, data) {
    let item = await this.query().findOne(where)
    if (!item) {
      item = await this.query().insert(data)
    } else {
      item = await item.$query().patchAndFetch(data)
    }
    return item
  }

  static createValidator () {
    return new Validator(this.validator)
  }
  // relation helper
  static belongsToOne (modelClass, join = {}) {
    assert(!Array.isArray(modelClass.idColumn), 'Composite keys are not supported in belongsToOne shortcut currently')
    const { localKey, ...rest } = join
    return {
      relation: Model.BelongsToOneRelation,
      modelClass,
      join: {
        from: `${this.tableName}.${localKey || foreignIdColumnName(modelClass.tableName)}`,
        to: `${modelClass.tableName}.${modelClass.idColumn}`,
        ...rest
      }
    }
  }
  static hasMany (modelClass, join = {}) {
    assert(!Array.isArray(this.idColumn), 'Composite keys are not supported in hasMany shortcut currently')
    const { foreignKey = foreignIdColumnName(this.tableName), ...rest } = join
    return {
      relation: Model.HasManyRelation,
      modelClass,
      foreignKey,
      join: {
        from: `${this.tableName}.${this.idColumn}`,
        to: `${modelClass.tableName}.${foreignKey}`,
        ...rest
      }
    }
  }
  static hasOne (modelClass, join = {}) {
    assert(!Array.isArray(this.idColumn), 'Composite keys are not supported in hasOne shortcut currently')
    const { foreignKey = foreignIdColumnName(this.tableName), ...rest } = join
    return {
      relation: Model.HasOneRelation,
      modelClass,
      foreignKey,
      join: {
        from: `${this.tableName}.${this.idColumn}`,
        to: `${modelClass.tableName}.${foreignKey}`,
        ...rest
      }
    }
  }
  static manyToMany (modelClass, join = {}) {
    assert(!(Array.isArray(this.idColumn) || Array.isArray(modelClass.idColumn)), 'Composite keys are not supported in manyToMany shortcut currently')
    const { throughTable, foreignKey = foreignIdColumnName(this.tableName), ...rest } = join
    assert(!isEmpty(throughTable))
    // const relation = modelClass.findRelation(this, Model.ManyToManyRelation)
    return {
      relation: Model.ManyToManyRelation,
      modelClass,
      foreignKey,
      join: {
        from: `${this.tableName}.${this.idColumn}`,
        through: {
          from: `${throughTable}.${foreignKey}`,
          to: `${throughTable}.${foreignIdColumnName(modelClass.tableName)}`
        },
        to: `${modelClass.tableName}.${modelClass.idColumn}`,
        ...rest
      }
    }
  }
  // static hasOneThrough (modelClass, join = {}) {
  //   assert(!(Array.isArray(this.idColumn) || Array.isArray(modelClass.idColumn)), 'Composite keys are not supported in hasOneThrough shortcut currently')
  //   const { throughTable, ...rest } = join
  //   assert(!isEmpty(throughTable))
  //   return {
  //     relation: Model.HasOneThroughRelation,
  //     modelClass,
  //     join: {
  //       from: `${this.tableName}.${this.idColumn}`,
  //       through: {
  //         from: `${throughTable}.${foreignIdColumnName(this.tableName)}`,
  //         to: `${throughTable}.${foreignIdColumnName(modelClass.tableName)}`
  //       },
  //       to: `${modelClass.tableName}.${modelClass.idColumn}`,
  //       ...rest
  //     }
  //   }
  // }
}
