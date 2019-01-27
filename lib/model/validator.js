const { Validator, ValidationError } = require('objection')
const { pick } = require('lodash')
const yup = require('yup')

module.exports = class extends Validator {
  constructor (schema) {
    super(schema)
    this.schema = schema
  }
  // model: The model instance. May be empty at this point.
  // json:
  // The properties to validate. After validation these values will
  // be merged into `model` by objection.
  // opt:
  // `ModelOptions` object. If your custom validator sets default
  // values or has the concept of required properties, you need to
  // check the `opt.patch` boolean. If it is true we are validating
  // a patch object (an object with a subset of model's properties).
  // ctx:
  // A context object shared between the validation methods. A new
  // object is created for each validation operation. You can store
  // whatever you need in this object.
  validate ({ model, json, options = {}, ctx }) {
    if (!this.schema) return json
    try {
      // Do your validation here and throw any exception if the
      // validation fails.
      const validator = yup.object().shape(options.patch ? pick(this.schema, Object.keys(json)) : this.schema)
      json = validator.validateSync(json)
      // You need to return the (possibly modified) json.
      return json
    } catch (e) {
      throw new ValidationError({ type: 'ModelValidation', message: e.errors, data: json, statusCode: 422 })
    }
  }
}
