const compose = require('koa-compose')
const os = require('os')
const bodyParser = require('koa-body')
const cors = require('@koa/cors')
const logger = require('koa-logger')
const middlewares = module.exports = {
  basic (options = {}) {
    const { error, body = {}, cors: corsOptions, logger: loggerOptions } = options
    return compose([
      middlewares.errorHandlerJson(error),
      bodyParser({
        multipart: true,
        formidable: { uploadDir: os.tmpdir() },
        ...body
      }),
      cors(corsOptions),
      logger(loggerOptions)
    ])
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
