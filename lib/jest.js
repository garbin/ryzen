const request = require('supertest')
const Router = require('koa-router')
const assert = require('assert')
const { test, describe, expect, beforeAll, beforeEach } = global
class HttpTester {
  constructor (server) {
    this.request = request(server)
    this.settings = {
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
  assert (asserter) {
    assert(asserter instanceof Function, 'asserter should be a function')
    this.asserter = asserter
    return this
  }
  test (description) {
    assert(this.asserter instanceof Function, '')
    const { method, path, data, params } = this.settings
    test(description || `${method.toUpperCase()} ${path}`, async () => {
      let request = this.request[method](Router.url(path, params instanceof Function ? params() : params))
      if (data) request = request.send(data)
      const response = await request
      this.asserter(response)
    })
  }
}
test.restful = function (server, router, runTester, description) {
  describe(description || router.resourceRootName, () => {
    const tester = {
      async prepareData (data, after) {
        data = data instanceof Function ? data({ server, router }) : data
        after = after || (item => item)
        assert(after instanceof Function, 'after should be a function')
        const item = await router.model.query().insert(data)
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
        return httpTester.set({ method: 'post', path: router.resourceRootPath, data }).assert(res => {
          expect(res.status).toBe(201)
          expect(res.body).toMatchObject(data)
        })
      },
      read (item) {
        tester.read.list().test()
        tester.read.item(item).test()
      }
    }
    tester.read.list = () => {
      const httpTester = new HttpTester(server)
      return httpTester.set({ path: router.resourceRootPath }).assert(res => {
        expect(res.status).toBe(200)
        expect(res.body).toBeInstanceOf(Array)
        expect(res.headers).toHaveProperty('content-range')
      })
    }
    tester.read.item = id => {
      const httpTester = new HttpTester(server)
      return httpTester.set({
        path: router.resourceItemPath,
        params: () => ({
          [router.idColumn]: id instanceof Function ? id() : id
        })
      }).assert(res => {
        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty(router.idColumn)
      })
    }
    runTester(tester)
  })
}
