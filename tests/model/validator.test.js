const { ValidationError } = require('objection')
const { Validator } = require('../../lib/model')
const { string } = require('yup')

describe('model/validator', () => {
  const validator = new Validator({
    title: string().min(3).required(),
    contents: string().required()
  })
  test('valid json should be passed', async () => {
    const json = { title: 'title', contents: 'contents' }
    expect(validator.validate({ json })).toEqual(json)
  })
  test('valid json should be passed on patch', async () => {
    const json = { title: 'title' }
    expect(validator.validate({ json, options: { patch: true } })).toEqual(json)
  })
  test('inValid json should throw error', async () => {
    expect(validator.validate.bind(validator, { json: { title: '' } })).toThrowError(ValidationError)
  })
  test('no schema should return directly', async () => {
    const noSchemaValidator = new Validator()
    const json = { title: 'title' }
    expect(noSchemaValidator.validate({ json })).toEqual(json)
  })
})
