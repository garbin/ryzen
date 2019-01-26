const { ValidationError } = require('objection')
const { Validator } = require('../../lib/model')
const { string } = require('yup')
const { describe, test, expect } = global

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
})
