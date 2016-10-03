// @flow
import {applyMiddleware} from 'redux'

export default function storeEnhancer (middleware: Array<any>): Function {
  return applyMiddleware(...middleware)
}
