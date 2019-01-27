// Update with your config settings.
module.exports = {
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  },
  client: 'postgres',
  debug: true,
  connection: {
    host: 'localhost',
    user: 'postgres',
    password: '123456',
    database: 'merry_test',
    charset: 'utf8'
  }
}
