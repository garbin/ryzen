const request = require('supertest')
const path = require('path')
const { ValidationError } = require('objection')
const { Application, Router, middlewares } = require('../../lib')
const { afterEach, descirbe, afterAll, beforeAll, test, expect} = global

describe('middlewares', () => {
  let server
  afterEach(() => {
    server && server.close()
  })
  test('basic', async () => {
    const app = new Application()
    app.use(middlewares.basic({ logger: false, error: { emit: false } }))
    app.use(async ctx => {
      expect(ctx.request.body.test).toBe('test')
      expect(ctx.request.files.file.name).toBe('upload.txt')
      throw new ValidationError({ type: 'ModelValidation', message: 'Validation Error', data: {}, statusCode: 422 })
    })
    server = app.listen()
    const response = await request(server)
      .post('/upload')
      .field('test', 'test')
      .attach('file', path.resolve(__dirname, '../_lib/upload.txt'))
    expect(response.status).toBe(422)
  })
  test('router', async () => {
    const app = new Application()
    const router = new Router()
    router.get('/test', async ctx => {
      ctx.body = 'test'
    })
    app.use(middlewares.basic({ logger: false, error: { emit: false } }))
    app.use(middlewares.router(router))
    server = app.listen()
    const response = await request(server).get('/test')
    expect(response.status).toBe(200)
    expect(response.text).toBe('test')
  })
  test('multi routers', async () => {
    const app = new Application()
    const router1 = new Router()
    router1.get('/router1', async ctx => {
      ctx.body = 'router1'
    })
    const router2 = new Router()
    router2.get('/router2', async ctx => {
      ctx.body = 'router2'
    })
    app.use(middlewares.basic({ logger: false, error: { emit: false } }))
    app.use(middlewares.router([router1, router2]))
    server = app.listen()
    const res1 = await request(server).get('/router1')
    expect(res1.status).toBe(200)
    expect(res1.text).toBe('router1')
    const res2 = await request(server).get('/router2')
    expect(res2.status).toBe(200)
    expect(res2.text).toBe('router2')
  })
})
