const { ApolloServer } = require('apollo-server-koa')

module.exports = function (...middlewares) {
  const options = middlewares.pop()
  const server = new ApolloServer({ debug: process.env.NODE_ENV !== 'production', ...options })
  return server
}
