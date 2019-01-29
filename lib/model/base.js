const { Model } = require('objection')
const { first, last, isEmpty } = require('lodash')
const assert = require('assert')
const Validator = require('./validator')
const { singular } = require('pluralize')

function foreignIdColumnName (tableName) {
  return `${singular(tableName)}_id`
}

module.exports = class extends Model {
  $beforeInsert () {
    super.$beforeInsert()
    const timestamps = this.timestamps === true ? ['created_at', 'updated_at'] : this.timestamps
    if (timestamps) {
      const now = new Date()
      this[first(timestamps)] = now
      this[last(timestamps)] = now
    }
  }

  $beforeUpdate () {
    super.$beforeUpdate()
    const timestamps = this.timestamps === true ? ['created_at', 'updated_at'] : this.timestamps
    if (timestamps) {
      this[last(timestamps)] = new Date()
    }
  }
  get timestamps () {
    return true
  }
  // static get validator () {}
  // static get relations () {}
  static get relationMappings () {
    return this.relations
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
    const { foreignKey, ...rest } = join
    return {
      relation: Model.HasManyRelation,
      modelClass,
      join: {
        from: `${this.tableName}.${this.idColumn}`,
        to: `${modelClass.tableName}.${foreignKey || foreignIdColumnName(this.tableName)}`,
        ...rest
      }
    }
  }
  static hasOne (modelClass, join = {}) {
    assert(!Array.isArray(this.idColumn), 'Composite keys are not supported in hasOne shortcut currently')
    const { foreignKey, ...rest } = join
    return {
      relation: Model.HasOneRelation,
      modelClass,
      join: {
        from: `${this.tableName}.${this.idColumn}`,
        to: `${modelClass.tableName}.${foreignKey || foreignIdColumnName(this.tableName)}`,
        ...rest
      }
    }
  }
  static manyToMany (modelClass, join = {}) {
    assert(!(Array.isArray(this.idColumn) || Array.isArray(modelClass.idColumn)), 'Composite keys are not supported in manyToMany shortcut currently')
    const { throughTable, ...rest } = join
    assert(!isEmpty(throughTable))
    return {
      relation: Model.ManyToManyRelation,
      modelClass,
      join: {
        from: `${this.tableName}.${this.idColumn}`,
        through: {
          from: `${throughTable}.${foreignIdColumnName(this.tableName)}`,
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
