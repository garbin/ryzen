const { Validator } = require('objection')
const Knex = require('knex')
const { string, number } = require('yup')
const { Base } = require('../../lib/model')
const knexConfig = require('../_lib/knex/knexfile')
const { afterAll, describe, test, expect } = global

const knex = Knex(knexConfig)
Base.knex(knex)
afterAll(async () => {
  await knex.destroy()
})
describe('model/base', () => {
  class Category extends Base {
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
        post: this.manyToMany(Post, { throughTable: 'post_2_category' })
      }
    }
    static get timestamps () { return false }
  }
  class Comment extends Base {
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
  class Signature extends Base {
    static get tableName () {
      return 'signatures'
    }
    static get validator () {
      return {
        signature: string().required(),
        post_id: number().integer().required()
      }
    }
    static get relations () {
      return {
        post: this.belongsToOne(Post)
      }
    }
  }

  class Post extends Base {
    static get tableName () {
      return 'posts'
    }
    static get validator () {
      return {
        title: string().min(3).required(),
        contents: string().required()
      }
    }
    static get relations () {
      return {
        comments: this.hasMany(Comment),
        categories: this.manyToMany(Category, {
          throughTable: 'post_2_category'
        }),
        signature: this.hasOne(Signature)
      }
    }
  }
  test('should have an correct validator', async () => {
    const validator = Post.createValidator()
    expect(validator).toBeInstanceOf(Validator)
    expect(Object.keys(validator.schema)).toEqual(Object.keys(Post.validator))
    expect(Object.keys(Post.relationMappings)).toEqual(Object.keys(Post.relations))
  })
  test('belongsToOne should generated correctly', () => {
    expect(Comment.relations).toHaveProperty('post.join.from', 'comments.post_id')
    expect(Comment.relations).toHaveProperty('post.join.to', 'posts.id')
  })
  test('hasMany should generated correctly', () => {
    expect(Post.relations).toHaveProperty('comments.join.from', 'posts.id')
    expect(Post.relations).toHaveProperty('comments.join.to', 'comments.post_id')
  })
  test('hasOne should generated correctly', () => {
    expect(Post.relations).toHaveProperty('signature.join.from', 'posts.id')
    expect(Post.relations).toHaveProperty('signature.join.to', 'signatures.post_id')
  })
  test('manyToMany should generated correctly', () => {
    expect(Post.relations).toHaveProperty('categories.join.from', 'posts.id')
    expect(Post.relations).toHaveProperty('categories.join.through.from', 'post_2_category.post_id')
    expect(Post.relations).toHaveProperty('categories.join.through.to', 'post_2_category.category_id')
    expect(Post.relations).toHaveProperty('categories.join.to', 'categories.id')
  })
  test('upsert', async () => {
    let cate = await Category.upsert({ category_name: 'not_exists' }, { category_name: 'not_exists', desc: 'desc' })
    expect(cate.id).toBeGreaterThanOrEqual(1)
    const old = cate.id
    cate = await Category.upsert({ category_name: 'not_exists' }, { category_name: 'not_exists', desc: 'new desc' })
    expect(cate.id).toEqual(old)
    expect(cate.desc).toBe('new desc')
  })
})
