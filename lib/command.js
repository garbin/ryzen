class Command {
  constructor (command, options) {
    const yargs = require('yargs')
    const { strict = true, default: defaultCommand = [] } = options
    process.argv = !process.argv[2] ? process.argv.concat(defaultCommand || []) : process.argv
    yargs.strict(strict).usage('$0 <cmd> [args]')
    // commands
    yargs.command(command.command || '*', command.describe, command.builder || {}, argv => {
      const result = command.handler(argv)
      if (result instanceof Promise) {
        result.then(r => process.exit()).catch(e => {
          console.error(e)
          process.exit(1)
        })
      }
    })
    this.yargs = yargs
  }
  command (options) {
    this.yargs.command(options)
    return this
  }
  exec () {
    return this.yargs.fail((msg, err, yargs) => {
      if (err) throw err
      console.error('Error:')
      console.error(msg)
      console.error('You should be doing', yargs.help())
      process.exit(1)
    }).help().argv
  }
}

module.exports = (command, options = {}) => {
  return new Command(command, options)
}
