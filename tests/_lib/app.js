const knexConfig = require('../_lib/knex/knexfile')
const { Application, Model, router, middlewares } = require('../../lib')
const Knex = require('knex')
const { string, number } = require('yup')
class Comment extends Model {
  static get tableName () {
    return 'comments'
  }
  static get validator () {
    return {
      comment: string().required()
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

const app = new Application()
const knex = Knex(knexConfig)
Model.knex(knex)
app.use(middlewares.basic({ logger: false, error: { emit: true } }))
const comments = router.restful(Comment, router => {
  router.create()
  router.read()
  router.update()
  router.destroy()
})
const posts = router.restful(Post, router => {
  router.create()
  router.read({
    sortable: ['created_at'],
    searchable: ['title']
  })
  router.update()
  router.destroy()
}).children(comments)
app.use(middlewares.router(posts))
const server = require.mail === module ? app.listen(8000, () => console.log('server started')) : app.listen()
module.exports = {
  server,
  routers: { posts, comments },
  app,
  knex,
  models: { Post, Comment }
}
