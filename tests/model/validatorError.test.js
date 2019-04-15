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
  test('inValid json should throw ValidationError', async () => {
    expect(validator.validate.bind(validator, { json: { title: '' } })).toThrowError(ValidationError)
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
