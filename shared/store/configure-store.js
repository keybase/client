import configureStoreNative from './configure-store.native'
import {applyMiddleware} from 'redux'
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import rootReducer from '../reducers'
import Immutable from 'immutable'
import {enableStoreLogging, enableActionLogging} from '../local-debug'
import {actionLogger} from './action-logger'
import createSagaMiddleware from 'redux-saga'

import {call} from 'redux-saga/effects'
import {signupSaga} from '../actions/signup'

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
  collapsed: true
}) : null

function * mainSaga (getState) {
  const signup = call(signupSaga)
  yield [signup]
}

const sagaMiddleware = createSagaMiddleware(mainSaga)

const createStoreWithMiddleware = enableStoreLogging
  ? applyMiddleware(sagaMiddleware, thunkMiddleware, loggerMiddleware)
  : (enableActionLogging
    ? applyMiddleware(sagaMiddleware, thunkMiddleware, actionLogger)
    : applyMiddleware(sagaMiddleware, thunkMiddleware))

export default function configureStore (initialState) {
  return configureStoreNative(createStoreWithMiddleware)(rootReducer, initialState)
}
