// Update with your config settings.
module.exports = {
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  },
  client: 'postgres',
  // debug: true,
  connection: process.env.DATABASE_CONNECTION || {
    host: 'localhost',
    user: 'postgres',
    password: '123456',
    database: 'ryzens_test',
    charset: 'utf8'
  }
}
