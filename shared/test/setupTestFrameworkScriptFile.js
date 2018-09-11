// @noflow
// Used by jest. We need to force things to flush to glamor doesn't write things out of order
/* eslint-disable */
import {flush} from 'glamor'

afterEach(() => {
  flush()
})
