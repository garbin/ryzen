const request = require('supertest')
const { Application } = require('../../lib')

describe('application', () => {
  let server
  afterEach(() => {
    server && server.close()
  })
  test('should have koa-qs wrappered', async () => {
    const app = new Application()
    app.use(async ctx => {
      expect(ctx.request.query.a).toEqual(['1', '2', '3'])
      expect(ctx.request.querystring).toBe('a[0]=1&a[1]=2&a[2]=3')
      ctx.status = 204
    })
    server = app.listen()
    const response = await request(server).get('/?a[0]=1&a[1]=2&a[2]=3')
    expect(response.status).toBe(204)
  })
})
