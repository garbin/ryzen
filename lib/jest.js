const request = require('supertest')
const Router = require('koa-router')
const assert = require('assert')
const { last } = require('lodash')
const { test, describe, expect, beforeAll, beforeEach } = global
class HttpTester {
  constructor (server) {
    this.request = request(server)
    this.settings = {
      descPath: '/',
      method: 'get',
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
  query (query) {
    this.settings.query = query
    return this
  }
  assert (asserter) {
    assert(asserter instanceof Function, 'asserter should be a function')
    this.asserter = asserter
    return this
  }
  test (description) {
    const { method, query, path, data, params } = this.settings
    description = description || `${method.toUpperCase()} ${this.settings.descPath}`
    test(description, async () => {
      const apiPath = Router.url(path instanceof Function ? path() : path, params instanceof Function ? params() : params)
      let request = this.request[method](apiPath)
      if (query) request = request.query(query)
      if (data) request = request.send(data)
      const response = await request
      this.asserter(response)
    })
  }
}

function getResourcePath ({ routers, instances = [] }, root = true) {
  return routers.map((router, index) => index === routers.length - 1 ? router[root ? 'resourceRootPath' : 'resourceItemPath'] : Router.url(router.resourceItemPath, {

    [router.idColumn]: instances[index]()[router.idColumn]
  })).join('')
}

function createTester (server, routers, instances = []) {
  routers = Array.isArray(routers) ? routers : [routers]
  const router = last(routers)
  const tester = {
    nestedTest () {
      test('nested test', () => {
        console.log(getResourcePath({ routers, instances }))
        expect(true).toBe(true)
      })
    },
    async prepareData (data, after) {
      const instance = last(instances)
      const query = instance ? instance().$relatedQuery('comments') : router.model.query()
      data = data instanceof Function ? data({ server, router }) : data
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
      data = data instanceof Function ? data({ server, router }) : data
      return httpTester.set({
        descPath: router.resourceRootPath,
        method: 'post',
        path: getResourcePath.bind(this, { routers, instances }),
        data
      }).assert(res => {
        expect(res.status).toBe(201)
        expect(res.body).toMatchObject(data)
      })
    },
    read (item) {
      tester.read.list().test()
      tester.read.item(item).test()
    },
    update (id, data) {
      const httpTester = new HttpTester(server)
      data = data instanceof Function ? data({ server, router }) : data
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
        expect(res.body).toMatchObject(data)
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
    nested (instance, childRouter, runTester, description) {
      describe(`${description || childRouter.resourceRootName}`, () => {
        runTester(createTester(server, [...routers, childRouter], [...instances, instance]))
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
  describe(description || router.resourceRootName, () => {
    runTester(createTester(server, router))
  })
}
