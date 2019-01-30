const knexConfig = require('../_lib/knex/knexfile')
const { Application, Model, router, middlewares, graphql: { presets, types, relay } } = require('../../lib')
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

const CommentType = new types.Object({
  name: 'Comment',
  fields: presets.model({
    id: types.nonNull(types.ID),
    title: types.string(),
    content: types.string()
  })
})
const PostType = new types.Object({
  name: 'Post',
  fields: presets.model({
    id: types.nonNull(types.ID),
    title: types.string(),
    content: types.string(),
    comments: types.list(CommentType, {
      resolve: presets.batch.hasMany(Comment)
    }),
    test1: types.string(),
    created_at: types.datetime(),
    updated_at: types.datetime()
  })
})
const SearchType = new types.Enum({
  name: 'SearchType',
  values: {
    POST: { value: Post }
  }
})
const PostConnection = relay.connection.create(PostType)

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
middlewares.graphql(app, {
  schema: new types.Schema({
    query: new types.Object({
      name: 'Query',
      fields: {
        test: types.type(types.JSON, {
          args: { input: types.json() },
          resolve (root, { input }) {
            return { field: 'field', input }
          }
        })
      }
    })
  })
})
const server = require.main === module ? app.listen(8000, () => console.log('server started')) : app.listen()
module.exports = {
  server,
  routers: { posts },
  app,
  knex,
  models: { Post, Comment, Category }
}
