// @flow
import {compose, applyMiddleware} from 'redux'

export default function storeEnhancer(middleware: Array<any>): Function {
  return compose(applyMiddleware(...middleware))
}
