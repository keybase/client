import configureStoreNative from './configure-store.native'
import {applyMiddleware} from 'redux'
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import rootReducer from '../reducers'
import Immutable from 'immutable'
import {enableStoreLogging, enableActionLogging, closureStoreCheck} from '../local-debug'
import {actionLogger} from './action-logger'
import {closureCheck} from './closure-check'

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

const loggerMiddleware = enableStoreLogging ? createLogger({
  duration: true,
  stateTransformer: objToJS,
  actionTransformer: objToJS,
  collapsed: true,
}) : null

let middlewares = [thunkMiddleware]

if (enableStoreLogging) {
  middlewares.push(loggerMiddleware)
} else if (enableActionLogging) {
  middlewares.push(actionLogger)
}

if (closureStoreCheck) {
  middlewares.push(closureCheck)
}

const createStoreWithMiddleware = applyMiddleware.apply(null, middlewares)

export default function configureStore (initialState) {
  return configureStoreNative(createStoreWithMiddleware)(rootReducer, initialState)
}
