const casual = require('casual')
const { server, routers, knex } = require('../_lib/app')
const { test, afterAll, expect } = global

afterAll(() => { knex.destroy(); server.close() })
test.restful(server, routers.posts, ({ prepare, create, read }) => {
  let item
  prepare({
    title: casual.title,
    contents: casual.text,
    slug: casual.word
  }, ctx => { item = ctx })
  create(ctx => ({
    title: casual.title,
    contents: casual.text,
    slug: `${casual.word}-${Math.random() * 10000}`
  })).test()
  read.list().test()
  test('item', () => {
    expect(item).toBeInstanceOf(routers.posts.model)
  })
  read.item(() => item.id).test()
// tester.update(item, { title: 'updated' }).assert(res => {
//   expect(res.status).toBe(202)
//   expect(res.body.title).toBe('updated')
// }).test()
// tester.delete(item).test()
})
