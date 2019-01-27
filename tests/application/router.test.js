const request = require('supertest')
const knexConfig = require('../_lib/knex/knexfile')
const { Application, Model, RESTfulRouter, middlewares } = require('../../lib')
const Knex = require('knex')
const { string, number } = require('yup')
const { describe, expect, test, afterEach } = global
describe('router', () => {
  let server, knex
  afterEach(() => {
    server && server.close()
    knex && knex.destroy()
  })
  class Comment extends Model {
    static get tableName () {
      return 'comments'
    }
    static get validator () {
      return {
        comment: string().required(),
        post_id: number().integer().required()
      }
    }
    static get relations () {
      return {
        post: this.belongsToOne(Post)
      }
    }
  }
  class Post extends Model {
    static get tableName () {
      return 'posts'
    }
    static get validator () {
      return {
        title: string().required(),
        contents: string().required()
      }
    }
    static get relations () {
      return {
        comments: this.hasMany(Comment)
      }
    }
  }
  test('restful', async () => {
    const app = new Application()
    knex = Knex(knexConfig)
    Model.knex(knex)
    app.use(middlewares.basic({ logger: false, error: { emit: true } }))
    const comments = new RESTfulRouter(Comment)
    comments.read()
    const posts = new RESTfulRouter(Post)
    posts.read()
    posts.children(comments)
    app.use(middlewares.router(posts))
    server = app.listen()
    const response = await request(server).get('/posts')
    expect(response.status).toBe(200)
    expect(response.body).toBeInstanceOf(Array)
  })
})
