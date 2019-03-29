const request = require('supertest')
const Router = require('koa-router')
const assert = require('assert')
const { isObject, last, capitalize } = require('lodash')
const { test, describe, expect, beforeAll, beforeEach } = global

class HttpTester {
  constructor (server) {
    this.request = request(server)
    this.settings = {
      description: null,
      descPath: '/',
      method: 'get',
      middlewares: [],
      path: '/',
      query: null,
      data: null,
      params: null
    }
    this.asserter = res => expect(res.status).toBe(200)
  }
  set (settings) {
    this.settings = { ...this.settings, ...settings }
    return this
  }
  use (...middlewares) {
    this.settings.middlewares = this.settings.middlewares.concat(middlewares)
    return this
  }
  query (query) {
    this.settings.query = query
    return this
  }
  assert (asserter) {
    assert(asserter instanceof Function, 'asserter should be a function')
    this.asserter = asserter
    return this
  }
  getTest () {
    return async () => {
      const { method, query, path, data, params } = this.settings
      const apiPath = Router.url(path instanceof Function ? path() : path, params instanceof Function ? params() : params)
      let request = this.request[method](apiPath)
      this.settings.middlewares.forEach(middleware => { request = middleware(request) })
      if (query) request = request.query(query instanceof Function ? query() : query)
      if (data) {
        const body = data instanceof Function ? await data() : data
        for (let k in body) {
          body[k] = body[k] instanceof Function ? body[k]() : body[k]
        }
        request = request.send(body)
      }
      const response = await request
      this.asserter(response)
    }
  }
  test (description) {
    const { method } = this.settings
    description = description || this.settings.description || `${method.toUpperCase()} ${this.settings.descPath}`
    return test(description, this.getTest())
  }
  get only () {
    return {
      test: (description) => {
        const { method } = this.settings
        description = description || this.settings.description || `${method.toUpperCase()} ${this.settings.descPath}`
        test.only(description, this.getTest())
      }
    }
  }
}

function getResourcePath ({ routers, instances = [] }, root = true) {
  return routers.map((router, index) => index === routers.length - 1 ? router[root ? 'resourceRootPath' : 'resourceItemPath'] : Router.url(router.resourceItemPath, {

    [router.idColumn]: instances[index]()[router.idColumn]
  })).join('')
}

function createRESTfulTester (server, routers, instances = []) {
  routers = Array.isArray(routers) ? routers : [routers]
  const router = last(routers)
  const tester = {
    async prepareData (data, after) {
      const instance = last(instances)
      const query = instance ? instance().$relatedQuery(router.resourceRootName) : router.model.query()
      data = data instanceof Function ? await data({ server, router }) : data
      after = after || (item => item)
      assert(after instanceof Function, 'after should be a function')
      const item = await query.insert(data)
      after(item)
    },
    prepare (data, after) {
      beforeAll(tester.prepareData.bind(this, data, after))
    },
    prepareEach (data, after) {
      beforeEach(tester.prepareData.bind(this, data, after))
    },
    create (data) {
      const httpTester = new HttpTester(server)
      if (data instanceof Function && data.constructor.name !== 'AsyncFunction') {
        data = data()
      }
      return httpTester.set({
        descPath: router.resourceRootPath,
        method: 'post',
        path: getResourcePath.bind(this, { routers, instances }),
        data
      }).assert(res => {
        expect(res.status).toBe(201)
        if (!(data instanceof Function)) {
          expect(res.body).toMatchObject(data)
        }
      })
    },
    read (item) {
      tester.read.list().test()
      tester.read.item(item).test()
    },
    update (id, data) {
      const httpTester = new HttpTester(server)
      if (data instanceof Function && data.constructor.name !== 'AsyncFunction') {
        data = data()
      }
      return httpTester.set({
        descPath: router.resourceItemPath,
        method: 'patch',
        path: getResourcePath.bind(this, { routers, instances }, false),
        params: () => ({
          [router.idColumn]: id instanceof Function ? id() : id
        }),
        data
      }).assert(res => {
        expect(res.status).toBe(202)
        if (!(data instanceof Function)) {
          expect(res.body).toMatchObject(data)
        }
      })
    },
    destroy (id) {
      const httpTester = new HttpTester(server)
      return httpTester.set({
        descPath: router.resourceItemPath,
        method: 'del',
        path: getResourcePath.bind(this, { routers, instances }, false),
        params: () => ({
          [router.idColumn]: id instanceof Function ? id() : id
        })
      }).assert(res => {
        expect(res.status).toBe(204)
      })
    },
    crud (options) {
      const { create, update, destroy, read } = options
      tester.create(create).test()
      tester.read(read)
      tester.update(update.id, update.data).test()
      tester.destroy(destroy).test()
    },
    nested (instance, childRouter, runTester, description) {
      description = description || `Nested ${childRouter.resourceRootName}`
      describe(description, () => {
        runTester(createRESTfulTester(server, [...routers, childRouter], [...instances, instance]))
      })
    }
  }
  tester.read.list = () => {
    const httpTester = new HttpTester(server)
    return httpTester.set({
      descPath: router.resourceRootPath,
      path: getResourcePath.bind(this, { routers, instances })
    }).assert(res => {
      expect(res.status).toBe(200)
      expect(res.body).toBeInstanceOf(Array)
      expect(res.headers).toHaveProperty('content-range')
    })
  }
  tester.read.item = id => {
    const httpTester = new HttpTester(server)
    return httpTester.set({
      descPath: router.resourceItemPath,
      path: getResourcePath.bind(this, { routers, instances }, false),
      params: () => ({
        [router.idColumn]: id instanceof Function ? id() : id
      })
    }).assert(res => {
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty(router.idColumn)
    })
  }
  return tester
}

test.restful = function (server, router, runTester, description) {
  description = description || `RESTful ${router.resourceRootName}`
  describe(description, () => {
    runTester(createRESTfulTester(server, router))
  })
}

class GraphqlTester extends HttpTester {
  constructor (server, endpoint) {
    super(server)
    this.set({ method: 'post', path: endpoint, descPath: endpoint })
  }
  query (query, variables) {
    this.settings.data = { query, variables }
    return this
  }
}

function createGraphQLTester (server, endpoint) {
  const tester = {
    query (query, variables) {
      const graphqlTester = new GraphqlTester(server, endpoint)
      return graphqlTester.query(query, variables)
    },
    mutate (type, options) {
      describe(`Mutations: ${type}`, () => {
        for (let mutate in options) {
          tester.mutate[mutate](type, options[mutate]).test()
        }
      })
    }
  }

  function parseFields (fields, root = []) {
    const request = []
    let asserts = []
    fields.forEach(field => {
      if (isObject(field)) {
        Object.entries(field).forEach(([field, childFields]) => {
          let isArray = false
          if (childFields[0] === '__array__') {
            isArray = true
            childFields.shift()
          }
          const child = parseFields(childFields, isArray ? [...root, field, '0'] : [...root, field])
          request.push(`
            ${field} {
              ${child.request.join('\n')}
            }
        `)
          asserts = asserts.concat(child.asserts)
        })
      } else {
        request.push(field)
        asserts.push([...root, field].join('.'))
      }
    })
    return {
      request,
      asserts
    }
  }
  function parseQuery (query, defaults = { pass: [], query: [] }) {
    const queryVars = defaults.query || []
    const passVars = defaults.pass || []
    Object.entries(query).forEach(([name, type]) => {
      queryVars.push(`$${name}: ${type}`)
      passVars.push(`${name}: $${name}`)
    })
    return {
      queryVars: queryVars.length ? `(${queryVars.join(',')})` : '',
      passVars: passVars.length ? `(${passVars.join(',')})` : ''
    }
  }

  tester.query.search = (type, options) => {
    const { fields, variables, query = {}, name = capitalize(type) } = options
    const { request, asserts } = parseFields(fields)
    const { queryVars, passVars } = parseQuery(query, { pass: [`type: ${type}`] })
    return tester.query(`
      query ${queryVars}{
        search${passVars} {
          edges {
            node {
              ... on ${name} {
                ${request.join('\n')}
              }
            }
          }
        }
      } 
    `, variables).set({ description: `GraphQL: search(${type})` }).assert(res => {
      expect(res.status).toBe(200)
      asserts.forEach(field => expect(res.body.data.search.edges[0]).toHaveProperty(`node.${field}`))
    })
  }

  tester.query.fetch = (type, options) => {
    const { fields, variables, query = { id: 'ID!' }, name = capitalize(type) } = options
    const { request, asserts } = parseFields(fields)
    const { queryVars, passVars } = parseQuery(query, { pass: [`type: ${type}`] })
    return tester.query(`
      query ${queryVars} {
        fetch${passVars} {
          ... on ${name} {
            ${request.join('\n')}
          }
        }
      } 
    `, variables).set({ description: `GraphQL: fetch(${type})` }).assert(res => {
      expect(res.status).toBe(200)
      asserts.forEach(field => expect(res.body.data.fetch).toHaveProperty(field))
    })
  }

  tester.mutate.create = (type, variables, fields) => {
    fields = fields || (variables.input ? Object.keys(variables.input) : fields)
    type = capitalize(type)
    const mutation = `create${type}`
    return tester.query(`
        mutation ($input: JSON!) {
          ${mutation}(input: $input) {
            ${fields.join('\n')} 
          }
        } 
    `, variables).set({ description: `GraphQL: mutation ${mutation}($${type.toLowerCase()})` }).assert(res => {
      expect(res.status).toBe(200)
      fields.forEach(field =>
        expect(res.body).toHaveProperty(`data.${mutation}.${field}`)
      )
    })
  }

  tester.mutate.update = (type, variables, fields) => {
    fields = fields || (variables.input ? Object.keys(variables.input) : fields)
    type = capitalize(type)
    const mutation = `update${type}`
    const updater = tester.query(`
        mutation ($id: ID!, $input: JSON!) {
          ${mutation}(id: $id, input: $input) {
            ${fields.join('\n')} 
          }
        } 
    `, variables).set({ description: `GraphQL: mutation ${mutation}($${type.toLowerCase()})` }).assert(res => {
      expect(res.status).toBe(200)
      fields.forEach(field =>
        expect(res.body).toHaveProperty(`data.${mutation}.${field}`)
      )
    })
    return updater
  }

  tester.mutate.remove = (type, variables) => {
    type = capitalize(type)
    const mutation = `remove${type}`
    return tester.query(`
        mutation ($id: ID!) {
          ${mutation}(id: $id)
        } 
    `, variables).set({ description: `GraphQL: mutation ${mutation}($${type.toLowerCase()})` }).assert(res => {
      expect(res.status).toBe(200)
      expect(res.body.data[mutation]).toBe(true)
    })
  }

  return tester
}

test.graphql = function (server, endpoint, runTester, description) {
  describe(description || `GraphQL ${endpoint}`, () => {
    runTester(createGraphQLTester(server, endpoint))
  })
}
