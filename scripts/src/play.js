const {parseDocument} = require('yaml')

const doc = parseDocument('a: []')
console.log(doc.getIn(['b']))
