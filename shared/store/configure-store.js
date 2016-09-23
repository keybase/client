// @flow
import {Iterable} from 'immutable'
import configureStoreNative from './configure-store.platform'
import createLogger from 'redux-logger'
import createSagaMiddleware from 'redux-saga'
import rootReducer from '../reducers'
import thunkMiddleware from 'redux-thunk'
import {actionLogger} from './action-logger'
import {applyMiddleware} from 'redux'
import {call} from 'redux-saga/effects'
import {closureCheck} from './closure-check'
import {enableStoreLogging, enableActionLogging, closureStoreCheck} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'

import deviceSaga from '../actions/devices'
import favoriteSaga from '../actions/favorite'
import gregorSaga from '../actions/gregor'
import kbfsSaga from '../actions/kbfs'
import pgpSaga from '../actions/pgp'
import profileSaga from '../actions/profile'
import searchSaga from '../actions/search'

// Transform objects from Immutable on printing
const objToJS = state => {
  var newState = {}

  Object.keys(state).forEach(i => {
    if (Iterable.isIterable(state[i])) {
      newState[i] = state[i].toJS()
    } else {
      newState[i] = state[i]
    }
  })

  return newState
}

const logger = {}

for (const method in console) {
  if (typeof console[method] === 'function') {
    logger[method] = (...args) => {
      requestIdleCallback(() => {
        console[method](...args)
      }, {timeout: 1e3})
    }
  }
}

const loggerMiddleware: any = enableStoreLogging ? createLogger({
  duration: true,
  stateTransformer: objToJS,
  actionTransformer: objToJS,
  collapsed: true,
  logger,
}) : null

function * mainSaga (getState) {
  yield [
    call(deviceSaga),
    call(favoriteSaga),
    call(gregorSaga),
    call(kbfsSaga),
    call(pgpSaga),
    call(profileSaga),
    call(searchSaga),
  ]
}

const sagaMiddleware = createSagaMiddleware()
let middlewares = [sagaMiddleware, thunkMiddleware]

if (enableStoreLogging) {
  middlewares.push(loggerMiddleware)
} else if (enableActionLogging) {
  middlewares.push(actionLogger)
}

if (closureStoreCheck) {
  middlewares.push(closureCheck)
}

const createStoreWithMiddleware = applyMiddleware.apply(null, middlewares)

export default function configureStore (initialState: any) {
  const s = configureStoreNative(createStoreWithMiddleware)(rootReducer, initialState)
  sagaMiddleware.run(mainSaga)
  return s
}
