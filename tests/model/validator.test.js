const { ValidationError } = require('objection')
const { Validator } = require('../../lib/model')
const { string } = require('yup')
const { describe, test, expect } = global

describe('model/validator', () => {
  const validator = new Validator({
    title: string().min(3).required(),
    contents: string().required()
  })
  const validatorWithGrammarMistake = new Validator({
    title: string().min(3).required(),
    contents: string().when('title', (title, schema) => {
      if (title === 'hello') {
        schema.notExistMethod().required()
      }
    })
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
  test('Grammar mistakes should throw specific error', async () => {
    expect(() => {
      validatorWithGrammarMistake.validate({
        json: {
          title: 'hello',
          contents: 'world'
        }
      })
    }).toThrowError(TypeError)
  })
})
