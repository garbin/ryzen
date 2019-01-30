const casual = require('casual')
const { first, last } = require('lodash')
const { server, models, knex } = require('../_lib/app')
const { beforeAll, afterAll, test, expect } = global
afterAll(() => {
  server.close()
  knex.destroy()
})
test.graphql(server, '/graphql', ({ query, mutate }) => {
  let post
  beforeAll(async () => {
    post = await models.Post.query().insert({ title: casual.title, contents: casual.text, slug: casual.uuid })
  })
  // test('post', () => expect(post).toBeInstanceOf(models.Post))
  query(`
    query ($input: JSON!){
      test(input: $input)
    }
  `, {
    input: { test: 'test' }
  }).assert(res => {
    expect(res.status).toBe(200)
    expect(res.body.data.test.field).toBe('field')
    expect(res.body.data.test.input).toEqual({ test: 'test' })
  }).test('basic query')
  // query.search({ type: 'POST' }).test()
  // query.fetch({ type: 'Post' }).test()
})
