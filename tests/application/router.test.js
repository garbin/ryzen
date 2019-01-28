const casual = require('casual')
const { server, routers, knex } = require('../_lib/app')
const { test, afterAll, expect } = global

afterAll(() => { knex.destroy(); server.close() })
test.restful(server, routers.posts, tester => {
  let item
  tester.prepare({
    title: casual.title,
    contents: casual.text,
    slug: casual.word
  }, ctx => { item = ctx })
  // tester.prepareEach(ctx => ({
  //   title: casual.title,
  //   contents: casual.text,
  //   slug: casual.word
  // }), ctx => {
  //   item = ctx
  // })
  // test('item', () => {
  //   expect(item).toBeInstanceOf(models.Post)
  // })
  tester.create(ctx => ({
    title: casual.title,
    contents: casual.text,
    slug: `${casual.word}-${Math.random() * 10000}`
  })).test()
// tester.read.list().test()
// tester.read.item(item).test()
// tester.update(item, { title: 'updated' }).assert(res => {
//   expect(res.status).toBe(202)
//   expect(res.body.title).toBe('updated')
// }).test()
// tester.delete(item).test()
})
