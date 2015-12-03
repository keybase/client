import {createStore, compose} from 'redux'
import {devTools} from 'redux-devtools'
import {isDev} from '../constants/platform'

export default f => {
  if (isDev) {
    return compose(f, devTools())(createStore)
  } else {
    return f(createStore)
  }
}
