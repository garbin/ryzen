const casual = require('casual')
const { first, last } = require('lodash')
const { server, routers, models, knex } = require('../_lib/app')
const { afterAll, beforeAll, test, expect } = global

afterAll(() => { knex.destroy(); server.close() })
test.restful(server, routers.categories, ({ prepareEach, crud }) => {
  let item
  prepareEach(() => ({ category_name: casual.name }), ctx => { item = ctx })
  crud({
    create: () => ({ category_name: casual.name }),
    read: () => item.id,
    update: { id: () => item.id, data: { category_name: 'updated' } },
    destroy: () => item.id
  })
})
test.restful(server, routers.posts, ({ prepare, prepareEach, crud, create, read, update, destroy, nested }) => {
  let item, post, category
  const data = {
    title: 'Ryzen is Awesome',
    contents: 'Ryzen is Awesome',
    slug: casual.uuid,
    status: 'public'
  }
  beforeAll(async () => {
    category = await models.Category.query().insert({
      category_name: casual.name
    })
    post = await models.Post.query().insert(data)
    await post.$relatedQuery('categories').relate(category.id)
  })
  // prepare(data, item => (post = item))
  prepareEach(() => ({
    title: casual.title,
    contents: casual.text,
    slug: casual.uuid
  }), ctx => { item = ctx })

  const middleware = req => req.set('CustomerHeader', 'Test')

  create(ctx => ({
    title: casual.title,
    contents: casual.text,
    slug: casual.uuid
  })).use(middleware).test()

  read.list().test()

  read.list().query({ sort: 'created_at' }).assert(res => {
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(Array)
  }).test('GET /posts with sort')

  read.list().query().assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).categories).toBeInstanceOf(Array)
  }).test('GET /posts with sub query by default')

  read.list().query(() => ({
    eager: ['[categories]']
  })).assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).categories).toBeInstanceOf(Array)
  }).test('GET /posts with sub query')

  read.list().query(() => ({
    eager: 'categories'
  })).assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).categories).toBeInstanceOf(Array)
  }).test('GET /posts with sub query string param')

  read.list().query(() => ({
    eager: ['[categories]', {
      categories: builder => {
        builder.select('id')
      }
    }]
  })).assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).categories.name).toBe(undefined)
  }).test('GET /posts with sub query with filter')

  read.list().query({
    sort: '-created_at',
    filters: { status: 'public' }
  }).assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).status).toBe('public')
  }).test('GET /posts with filters')

  read.list().query(() => ({
    join: 'categories',
    sort: '-created_at',
    filters: { category_id: category.id }
  })).assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).id).toBe(post.id)
  }).test('GET /posts with join filters')

  read.list().query({ sort: 'created_at', q: 'ryzen' }).assert(res => {
    expect(res.status).toBe(200)
    expect(first(res.body).title).toBe(data.title)
    expect(last(res.body).title).toBe(data.title)
  }).test('GET /posts with sort')
  read.item(() => item.id).test()

  read.item(() => item.id).query().assert(res => {
    expect(res.status).toBe(200)
    expect(res.body.categories).toBeInstanceOf(Array)
  }).test('GET /posts get one item with sub query')

  update(() => item.id, { title: 'updated' }).assert(res => {
    expect(res.status).toBe(202)
    expect(res.body.title).toBe('updated')
  }).test()

  destroy(() => item.id).test()

  nested(() => post, routers.posts.children.comments, ({ prepare, prepareEach, create, read, update, destroy, nestedTest }) => {
    let comment
    // prepare({ comment: casual.text }, item => {comment = item})
    prepareEach(() => ({ comment: casual.text }), item => { comment = item })
    create({ comment: casual.text }).test()
    read(() => comment.id)
    update(() => comment.id, { comment: 'updated' }).test()
    destroy(() => comment.id).test()
  })
})
