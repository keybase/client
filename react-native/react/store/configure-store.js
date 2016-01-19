import configureStoreNative from './configure-store.native'
import {applyMiddleware} from 'redux'
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import rootReducer from '../reducers'
import Immutable from 'immutable'
import {enableStoreLogging} from '../local-debug'

// Transform objects from Immutable on printing
const objToJS = state => {
  var newState = {}

  Object.keys(state).forEach(i => {
    if (Immutable.Iterable.isIterable(state[i])) {
      newState[i] = state[i].toJS()
    } else {
      newState[i] = state[i]
    }
  })

  return newState
}

// Only log if __DEV__
const loggerMiddleware = enableStoreLogging ? createLogger({
  duration: true,
  stateTransformer: objToJS,
  actionTransformer: objToJS,
  collapsed: true
}) : null

const createStoreWithMiddleware = enableStoreLogging
  ? applyMiddleware(thunkMiddleware, loggerMiddleware)
  : applyMiddleware(thunkMiddleware)

export default function configureStore (initialState: ?any) {
  return configureStoreNative(createStoreWithMiddleware)(rootReducer, initialState)
}
