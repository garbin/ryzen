const { command } = require('../lib')
const { last } = require('lodash')
const { describe, test, expect } = global

describe('Command', () => {
  test('command should return a function that can be execute', async () => {
    process.argv.push('test')
    command({
      describe: 'Default Command',
      handler (argv) {
        expect(last(argv._)).toBe('test')
      }
    }).exec()
  })
})
