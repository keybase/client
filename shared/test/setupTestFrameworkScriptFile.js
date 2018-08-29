// @noflow
// Used by jest. We need to force things to flush to glamor doesn't write things out of order
/* eslint-disable */
// DON'T use es6 stuff here
const {flush} = require('glamor')

afterEach(() => {
  flush()
})
