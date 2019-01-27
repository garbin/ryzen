const Koa = require('koa')
const qs = require('koa-qs')
const middlewares = require('./middlewares')
const Router = require('./router')
class Application extends Koa {
  constructor (...args) {
    super(...args)
    qs(this)
  }
}

module.exports = { Application, middlewares, Router }
