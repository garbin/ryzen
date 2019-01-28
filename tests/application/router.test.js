const casual = require('casual')
const { first, last } = require('lodash')
const { server, routers, knex } = require('../_lib/app')
const { test, afterAll, expect } = global

afterAll(() => { knex.destroy(); server.close() })
test.restful(server, routers.posts, ({ prepare, prepareEach, create, read, update, destroy }) => {
  let item
  const post = {
    title: 'Ryzen is Awesome',
    contents: 'Ryzen is Awesome',
    slug: casual.uuid
  }
  prepare(post)
  prepareEach(() => ({
    title: casual.title,
    contents: casual.text,
    slug: casual.uuid
  }), ctx => { item = ctx })
  create(ctx => ({
    title: casual.title,
    contents: casual.text,
    slug: casual.uuid
  })).test()
  read.list().test()
  read.list().query({ sort: 'created_at' }).assert(res => {
    expect(res.status).toBe(200)
    expect(res.body[0].id).toBe(1)
  }).test('GET /posts with sortable & searchable')
  read.list().query({ sort: 'created_at', q: 'ryzen' }).assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).title).toBe(post.title)
    expect(last(res.body).title).toBe(post.title)
  }).test('GET /posts with sortable')
  read.item(() => item.id).test()
  update(() => item.id, { title: 'updated' }).assert(res => {
    expect(res.status).toBe(202)
    expect(res.body.title).toBe('updated')
  }).test()
  destroy(() => item.id).test()
})
