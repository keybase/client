// @flow
import DevTools from '../../desktop/renderer/redux-dev-tools'
import {compose, applyMiddleware} from 'redux'
import {enableStoreLogging} from '../local-debug'

export default function storeEnhancer (middleware: Array<any>): Function {
  if (enableStoreLogging) {
    return compose(applyMiddleware(...middleware), DevTools.instrument())
  }
  return applyMiddleware(...middleware)
}
