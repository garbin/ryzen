## Model
First: initial database connection
```js
import { Model } from 'ryzens'
import knex from 'knex'
import knexConfig from 'path/to/knexfile.js'
Model.knex(knex(knexConfig))
```
Second: Model defination
```js
import { Model } from 'ryzens'
import password from 'objection-password'
import {string} from 'yup'
const Password = password({
  allowEmptyPassword: false,
  passwordField: 'password',
  rounds: 12
})
export class User extends Password(Model) {
  static get tableName () { return 'users' }
  static get vaildator () {
    return {
      username: string().min(1).max(100).required()
    }
  }
  static get relations () {
    return {
      posts: this.hasMany(Post)
    }
  }
}
export class Post extends Model {
  static get tableName () { return 'posts' }
  static get timestamps () {
    /**
     * return false
     * don't auto update date column
     */
    /**
     * return true
     * equals to return ['created_at', 'updated_at']
     */
    return ['created_at', 'updated_at']
  }
  static get validator () {
    return {
      title: string().min(3).max(256).required(),
      contents: string().required()
    }
  }
  static get relations () {
    return {
      user: this.belongsTo(User)
    }
  }
}
```
## Router
```js
import {router} from 'ryzens'
export const posts = router.restful(posts => {
  posts.create()
  // posts.read() is shorthand
  posts.read.list()
  posts.read.item()
  posts.update()
  posts.destroy()
})
```
## Application
```js
import { Application, middlewares } from 'ryzens'
import {router} from 'path/to/router'
// Application inherits from Koa, so app is an instance of Koa
export const app = new Application() 
// regular koa middleware
// app.use(middleware)
app.use(middlewares.basic()) // bodyParser, cors, jsonError & logger
app.use(middlewares.router(router)) 
app.listen(8000)
export const server = app.listen(8000)
```

## Test
```js
import { server } from 'path/to/app'
import { posts } from 'path/to/routers'
import casual from 'casual'
const { test } = global
test.restful(server, posts, (prepare, create, update, read, destroy) => {
  let post
  prepareEach(() => ({title: casual.title}), item => { post = item }) // equals to beforeAll
  const id = () => post.id
  create()
  read.list()
  read.item(id)
  update(id, {title: 'updated'})
  destroy(id)
})
```
