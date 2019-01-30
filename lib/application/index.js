const Koa = require('koa')
const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const qs = require('koa-qs')
const middlewares = require('./middlewares')
const router = require('./router')
const graphql = require('./graphql')

class Application extends Koa {
  constructor (...args) {
    super(...args)
    qs(this)
  }
  cluster (...args) {
    if (cluster.isMaster) {
      console.log(`Master ${process.pid} is running`)
      // Fork workers.
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork()
      }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`)
      })
    } else {
      console.log(`Worker ${process.pid} started`)
      return this.listen(...args)
    }
  }
}

module.exports = { Application, middlewares, router, graphql }
