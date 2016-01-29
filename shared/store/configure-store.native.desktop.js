import {createStore, compose} from 'redux'
import DevTools from '../../desktop/renderer/redux-dev-tools'
import {enableStoreLogging} from '../local-debug'

export default f => {
  if (enableStoreLogging) {
    return compose(f, DevTools.instrument())(createStore)
  } else {
    return f(createStore)
  }
}
