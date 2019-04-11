const knexConfig = require('../_lib/knex/knexfile')
const { Application, Model, router, middlewares, graphql } = require('../../lib')
const assert = require('assert')
const { presets, types, Loader } = graphql
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
  static get timestamps () {
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
      post: this.belongsTo(Post)
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
    comment: types.string()
  })
})
const PostType = new types.Object({
  name: 'Post',
  fields: presets.model({
    id: types.nonNull(types.ID),
    title: types.string(),
    contents: types.string(),
    comments: types.list(CommentType, {
      resolve: presets.batch.hasMany(Comment)
    }),
    created_at: types.datetime(),
    updated_at: types.datetime()
  })
})

const app = new Application()
const knex = Knex(knexConfig)
Model.knex(knex)
app.use(middlewares.basic({ accessLogger: false, error: { emit: true } }))
const posts = router.restful(Post, router => {
  router.create(async (ctx, next) => {
    assert(ctx.request.headers.customerheader === 'Test', 'CustomerHeader is requried')
    await next()
  })
  router.read({
    eager: ['[categories]'],
    join: 'categories',
    sortable: ['created_at'],
    searchable: ({ search, knex }) => {
      search('title')
      search('contents', null, true) // true will make orWhere
      /*
       equals
       search('title', (keywords, like, query) => {
         query.where('title', like, `%${keywords}%`)
       })
       */
    },
    filterable: ({ filter }) => {
      filter('status')
      filter('category_id')
    }
  })
  router.update()
  router.destroy()
}).child(Comment)
const categories = router.restful(Category, router => {
  router.crud()
})
app.use(middlewares.router(posts, categories))
graphql.server({
  context: ({ ctx }) => ({ loader: new Loader() }),
  // formatError: console.error,
  formatError: GraphQLError => {
    console.error('ERROR:', error.originalError)
    return error
  },
  schema: new types.Schema({
    mutation: new types.Object({
      name: 'Mutation',
      fields: {
        ...presets.mutation(PostType, {
          model: Post
        })
      }
    }),
    query: new types.Object({
      name: 'Query',
      fields: {
        test: types.type(types.JSON, {
          args: { input: types.json() },
          resolve (root, { input }) {
            return { field: 'field', input }
          }
        }),
        error: types.type(types.JSON, {
          args: { input: types.json() },
          resolve (root, { input }) {
            assert(false === true, 'Error')
          }
        }),
        search: presets.search({
          POST: types.type(PostType, {
            model: Post,
            compose: resolver => async (root, args, ctx, info) => {
              ctx.composed = true
              const result = await resolver(root, args, ctx, info)
              return result
            },
            resolveOptions: {
              sortable: ['created_at', 'updated_at'],
              searchable: ['title', 'contents'],
              filterable: ['status']
              // ({ filter, filterBy, query }) => {
              //   filter('status')
              //   if (filterBy.tag) {
              //     query.where('tags', 'like', `%\t${filterBy.tag}\t%`)
              //   }
              // }
            }
          })
        }),
        fetch: presets.fetch({
          POST: types.type(PostType, { model: Post })
        })
      }
    })
  })
}).applyMiddleware({ app, path: '/graphql' })
const server = require.main === module ? app.listen(8000, () => console.log('server started')) : app.listen()
module.exports = {
  server,
  routers: { posts, categories },
  app,
  knex,
  models: { Post, Comment, Category }
}
