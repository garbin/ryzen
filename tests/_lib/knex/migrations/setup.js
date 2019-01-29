
exports.up = function (knex, Promise) {
  return knex.schema.createTable('posts', function (table) {
    table.increments('id').primary()
    table.string('title')
    table.text('contents')
    table.string('slug').unique()
    table.enum('status', ['draft', 'private', 'public']).defaultTo('draft')
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
  }).createTable('comments', function (table) {
    table.increments('id').primary()
    table.text('comment')
    table.integer('post_id').references('id').inTable('posts')
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
  }).createTable('categories', function (table) {
    table.increments('id').primary()
    table.string('category_name')
  }).createTable('category2post', function (table) {
    table.integer('category_id').references('id').inTable('categories')
    table.integer('post_id').references('id').inTable('posts')
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTable('comments').dropTable('category2post').dropTable('categories').dropTable('posts')
}
