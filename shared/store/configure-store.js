// @flow
import createLogger from 'redux-logger'
import {run as runSagas, create as createSagaMiddleware} from './configure-sagas'
import rootReducer from '../reducers'
import storeEnhancer from './enhancer.platform'
import thunkMiddleware from 'redux-thunk'
import {Iterable} from 'immutable'
import {actionLogger} from './action-logger'
import {closureCheck} from './closure-check'
import {createStore} from 'redux'
import {
  enableStoreLogging,
  enableActionLogging,
  closureStoreCheck,
  immediateStateLogging,
} from '../local-debug'
import {globalError} from '../constants/config'
import {isMobile} from '../constants/platform'
import {requestIdleCallback} from '../util/idle-callback'
import {convertToError} from '../util/errors'

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
      requestIdleCallback(
        () => {
          console[method](...args)
        },
        {timeout: 1e3}
      )
    }
  }
}

let theStore: Store

const crashHandler = error => {
  if (__DEV__) {
    throw error
  }
  if (theStore) {
    theStore.dispatch({
      type: globalError,
      payload: convertToError(error),
    })
  } else {
    console.warn('Got crash before store created?', error)
  }
}

const loggerMiddleware: any = enableStoreLogging
  ? createLogger({
      duration: true,
      stateTransformer: objToJS,
      actionTransformer: objToJS,
      collapsed: true,
      logger,
    })
  : null

let lastError = new Error('')

const errorCatching = store => next => action => {
  try {
    return next(action)
  } catch (error) {
    // Don't let the same error keep getting caught
    if (lastError.message === error.message) {
      return
    }
    lastError = error
    console.warn(`Caught a middleware exception ${error}`)

    try {
      crashHandler(error) // don't let this thing crash us forever
    } catch (_) {}
  }
}

let middlewares = [errorCatching, createSagaMiddleware(crashHandler), thunkMiddleware]

if (enableStoreLogging) {
  middlewares.push(loggerMiddleware)
} else if (enableActionLogging) {
  middlewares.push(actionLogger)
}

if (closureStoreCheck) {
  middlewares.push(closureCheck)
}

export default function configureStore(initialState: any) {
  const store = createStore(rootReducer, initialState, storeEnhancer(middlewares))
  theStore = store

  if (module.hot && !isMobile) {
    // $FlowIssue
    module.hot.accept('../reducers', () => {
      store.replaceReducer(require('../reducers').default)
    })
  }

  runSagas()
  return store
}
