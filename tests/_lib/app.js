const knexConfig = require('../_lib/knex/knexfile')
const { Application, Model, router, middlewares } = require('../../lib')
const Knex = require('knex')
const { string } = require('yup')

class Category extends Model {
  static get tableName () {
    return 'categories'
  }
  static get validator () {
    return {
      category_name: string().required()
    }
  }
  static get relations () {
    return {
      posts: this.manyToMany(Post, { throughTable: 'category2post' })
    }
  }
  get timestamps () {
    return false
  }
}

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
      comments: this.hasMany(Comment),
      categories: this.manyToMany(Category, { throughTable: 'category2post' })
    }
  }
}

const app = new Application()
const knex = Knex(knexConfig)
Model.knex(knex)
app.use(middlewares.basic({ logger: false, error: { emit: true } }))
const posts = router.restful(Post, router => {
  router.create()
  router.read({
    join: 'categories',
    sortable: ['created_at'],
    searchable: ['title'],
    filterable: ({ filter }) => {
      filter('status')
      filter('category_id')
    }
  })
  router.update()
  router.destroy()
}).child(Comment)
app.use(middlewares.router(posts))
const server = require.main === module ? app.listen(8000, () => console.log('server started')) : app.listen()
module.exports = {
  server,
  routers: { posts },
  app,
  knex,
  models: { Post, Comment, Category }
}
