const { ApolloServer } = require('apollo-server-koa')

module.exports = function (...middlewares) {
  const options = middlewares.pop()
  const server = new ApolloServer(options)
  return server
}
