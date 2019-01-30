module.exports = {
  base64: {
    encode: str => Buffer.from(`${str}`).toString('base64'),
    decode: str => Buffer.from(`${str}`, 'base64').toString('ascii')
  },
  cursor2page (offset, limit) {
    const page = Math.floor((offset / limit))
    return [page, limit]
  }
}
