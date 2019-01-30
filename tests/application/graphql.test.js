const casual = require('casual')
// const { first, last } = require('lodash')
const { server, models, knex } = require('../_lib/app')
const { beforeAll, afterAll, test, expect } = global
afterAll(() => {
  server.close()
  knex.destroy()
})
test.graphql(server, '/graphql', ({ query, mutate }) => {
  let post = {}
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
  query.search('POST', ['id', 'title', 'contents']).test()
  query.fetch('POST', ['id', 'title', 'contents'], () => ({ id: post.id })).test()
  query(`
    mutation ($input: JSON!){
      createPost(input: $input) {
        id
        title
      }
    }
  `, {
    input: {
      title: 'mutation',
      contents: 'mutation'
    }
  }).assert(res => {
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('data.createPost.title', 'mutation')
  }).test('basic mutation')
  // mutate() equals to create, upadte, destroy
  mutate.create('Post', {
    input: {
      title: 'mutate create',
      contents: 'mutate create contents'
    }
  }).test()
  mutate.update('Post', () => ({
    id: post.id,
    input: { title: 'mutate updated' }
  })).test()
  // mutate.remove('Post', () => ({
  //   id: post.id
  // })).test()
  mutate('Post', {
    create: { input: { title: 'graphql', contents: 'graphql' } },
    update: () => ({ id: post.id, input: { title: 'update' } }),
    remove: () => ({ id: post.id })
  })
})
