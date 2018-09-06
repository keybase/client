// @flow
import logger from '../logger'
import rootReducer from '../reducers'
import {actionLogger} from './action-logger'
import {convertToError} from '../util/errors'
import {createLogger} from 'redux-logger'
import {createStore, applyMiddleware} from 'redux'
import {enableStoreLogging, enableActionLogging, filterActionLogs} from '../local-debug'
import * as DevGen from '../actions/dev-gen'
import * as ConfigGen from '../actions/config-gen'
import {isMobile} from '../constants/platform'
import {run as runSagas, create as createSagaMiddleware} from './configure-sagas'
import * as LocalConsole from '../util/local-console'

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
  // we don't print the state twice, lets just do it once per action
  let logStateOk = false
  loggerMiddleware = createLogger({
    actionTransformer: (...args) => {
      if (filterActionLogs) {
        args[0].type.match(filterActionLogs) && logger.info('Action:', ...args)
      } else if (args[0] && args[0].type) {
        LocalConsole.gray('Action:', args[0].type, '', args[0])
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
      if (logStateOk) {
        // This is noisy, so let's not show it while filtering action logs
        !filterActionLogs && LocalConsole.purpleObject('State:', ...args) // DON'T use the logger here, we never want this in the logs
        logStateOk = false
      } else {
        logStateOk = true
      }
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

const middlewares = [
  errorCatching,
  createSagaMiddleware(crashHandler),
  ...(enableStoreLogging && loggerMiddleware ? [loggerMiddleware] : []),
  ...(enableActionLogging ? [actionLogger] : []),
]

if (__DEV__ && typeof window !== 'undefined') {
  window.debugActionLoop = () => {
    setInterval(() => {
      theStore.dispatch(DevGen.createDebugCount())
    }, 1000)
  }
}

export default function configureStore() {
  const store = createStore(rootReducer, undefined, applyMiddleware(...middlewares))
  theStore = store

  if (module.hot && !isMobile) {
    module.hot.accept('../reducers', () => {
      store.replaceReducer(require('../reducers').default)
    })
  }

  runSagas()
  return store
}
