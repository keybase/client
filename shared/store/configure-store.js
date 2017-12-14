// @flow
import logger from '../logger'
import rootReducer from '../reducers'
import storeEnhancer from './enhancer.platform'
import thunkMiddleware from 'redux-thunk'
import {actionLogger} from './action-logger'
import {convertToError} from '../util/errors'
import {createLogger} from 'redux-logger'
import {createStore} from 'redux'
import {enableStoreLogging, enableActionLogging, filterActionLogs} from '../local-debug'
import * as DevGen from '../actions/dev-gen'
import * as ConfigGen from '../actions/config-gen'
import {isMobile} from '../constants/platform'
import {run as runSagas, create as createSagaMiddleware} from './configure-sagas'

let theStore: Store

const crashHandler = error => {
  if (__DEV__) {
    throw error
  }
  if (theStore) {
    theStore.dispatch(
      ConfigGen.createGlobalError({
        globalError: convertToError(error),
      })
    )
  } else {
    logger.warn('Got crash before store created?', error)
  }
}

let loggerMiddleware: any

if (enableStoreLogging) {
  loggerMiddleware = createLogger({
    actionTransformer: (...args) => {
      if (filterActionLogs) {
        args[0].type.match(filterActionLogs) && logger.info('Action:', ...args)
      } else if (args[0] && args[0].type) {
        logger.info('Action:', ...args)
      }
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
      // This is noisy, so let's not show it while filtering action logs
      !filterActionLogs && logger.info('State:', ...args)
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
    logger.warn(`Caught a middleware exception`)
    logger.debug(`Caught a middleware exception`, error)

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

if (__DEV__ && typeof window !== 'undefined') {
  window.debugActionLoop = () => {
    setInterval(() => {
      theStore.dispatch(DevGen.createDebugCount())
    }, 1000)
  }
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
