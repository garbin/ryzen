const compose = require('koa-compose')
const { flattenDeep } = require('lodash')
const Router = require('koa-router')
const assert = require('assert')
const os = require('os')
const bodyParser = require('koa-body')
const cors = require('@koa/cors')
const logger = require('koa-logger')
const middlewares = module.exports = {
  basic (options = {}) {
    const { error, body = {}, cors: corsOptions = {}, accessLogger } = options
    return compose([
      middlewares.errorHandlerJson(error),
      bodyParser({
        multipart: true,
        formidable: { uploadDir: os.tmpdir() },
        ...body
      }),
      cors({ exposeHeaders: ['Content-Range'], ...corsOptions }),
      logger(accessLogger || ((str, args) => {
        accessLogger !== false && console.log(str)
      }))
    ])
  },
  router (...routers) {
    routers = flattenDeep(routers)
    return compose(routers.map(router => {
      assert(router instanceof Router, 'The router you provided is not instance of Router(koa-router)')
      return router.routes()
    }))
  },
  errorHandlerJson (options = { emit: true }) {
    return async (ctx, next) => {
      try {
        await next()
      } catch (e) {
        let status = e.status || e.statusCode || 500
        ctx.status = status
        ctx.body = {
          status,
          name: e.name,
          message: e.message,
          type: e.type,
          stack: process.env.NODE_ENV === 'production' ? undefined : e.stack
        }
        options.emit && ctx.app.emit('error', e, ctx)
      }
    }
  }
}
