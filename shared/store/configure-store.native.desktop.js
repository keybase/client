import {createStore, compose} from 'redux'
import DevTools from '../../desktop/renderer/redux-dev-tools'

export default f => {
  if (__DEV__) { // eslint-disable-line no-undef
    return compose(f, DevTools.instrument())(createStore)
  } else {
    return f(createStore)
  }
}
