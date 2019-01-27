class Test {
  get read () {
    const read = () => console.log('Read')
    read.list = () => console.log('list')
    read.item = () => console.log('item')
    return read
  }
}
const test = new Test()
console.log(test.read)
test.read()
test.read.list()
test.read.item()
