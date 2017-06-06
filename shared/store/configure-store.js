// @flow
import rootReducer from '../reducers'
import storeEnhancer from './enhancer.platform'
import thunkMiddleware from 'redux-thunk'
import {actionLogger} from './action-logger'
import {closureCheck} from './closure-check'
import {convertToError} from '../util/errors'
import {createLogger} from 'redux-logger'
import {createStore} from 'redux'
import {
  enableStoreLogging,
  enableActionLogging,
  closureStoreCheck,
  immediateStateLogging,
} from '../local-debug'
import {globalError} from '../constants/config'
import {isMobile} from '../constants/platform'
import {run as runSagas, create as createSagaMiddleware} from './configure-sagas'
import {setupLogger, immutableToJS} from '../util/periodic-logger'

let theStore: Store

const crashHandler = error => {
  if (__DEV__) {
    throw error
  }
  if (theStore) {
    theStore.dispatch({
      payload: convertToError(error),
      type: globalError,
    })
  } else {
    console.warn('Got crash before store created?', error)
  }
}

let loggerMiddleware: any

if (enableStoreLogging) {
  const logger = setupLogger('storeLogger', 100, immediateStateLogging, immutableToJS, 50, true)
  loggerMiddleware = createLogger({
    actionTransformer: (...args) => {
      console.log('Action:', ...args)
      logger.log('Action:', ...args)
      return null
    },
    collapsed: true,
    duration: true,
    logger: {
      error: () => {},
      group: () => {},
      groupCollapsed: () => {},
      groupEnd: () => {},
      log: () => {},
      warn: () => {},
    },
    stateTransformer: (...args) => {
      logger.log('State:', ...args)
      return null
    },
    titleFormatter: () => null,
  })
}

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
    console.error(`Caught a middleware exception ${error}`)

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
    module.hot.accept('../reducers', () => {
      store.replaceReducer(require('../reducers').default)
    })
  }

  runSagas()
  return store
}
