import {createStore, compose} from 'redux'
import {devTools} from 'redux-devtools'

export default f => {
  if (__DEV__) { // eslint-disable-line no-undef
    return compose(f, devTools())(createStore)
  } else {
    return f(createStore)
  }
}
