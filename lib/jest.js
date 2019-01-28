const request = require('supertest')
const assert = require('assert')
const { test, describe, expect, beforeAll, beforeEach } = global
class HttpTester {
  constructor (server) {
    this.request = request(server)
    this.method = 'get'
    this.path = '/'
    this.data = null
    this.asserter = res => expect(res.status).toBe(200)
  }
  post (path) {
    this.method = 'post'
    this.path = path
    return this
  }
  send (data) {
    this.data = data
    return this
  }
  assert (asserter) {
    assert(asserter instanceof Function, 'asserter should be a function')
    this.asserter = asserter
    return this
  }
  test (description) {
    assert(this.asserter instanceof Function, '')
    test(description || `${this.method.toUpperCase} ${this.path}`, async () => {
      const response = await this.request.post(this.path).send(this.data)
      console.log(response.status, '========')
      // let request = this.request[this.method](this.path)
      // if (this.data) request = request.send(this.data)
      // const response = await request
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
        return httpTester.post(router.resourceRootPath).send(data).assert(res => {
          console.log(res.body)
          expect(res.status).toBe(201)
          expect(res.body).toMatchObject(data)
        })
      }
    }
    runTester(tester)
  })
}
