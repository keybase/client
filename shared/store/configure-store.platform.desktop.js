// @flow
import DevTools from '../../desktop/renderer/redux-dev-tools'
import {createStore, compose} from 'redux'
import {enableStoreLogging} from '../local-debug'

export default (f: Function) => {
  if (enableStoreLogging) {
    return compose(f, DevTools.instrument())(createStore)
  } else {
    return f(createStore)
  }
}
