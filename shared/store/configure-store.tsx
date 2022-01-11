import {run as runSagas, create as createSagaMiddleware} from './configure-sagas'
import logger from '../logger'
import rootReducer from '../reducers'
import {actionLogger} from './action-logger'
import {convertToError} from '../util/errors'
import {createStore, applyMiddleware, Store} from 'redux'
import {enableStoreLogging, enableActionLogging} from '../local-debug'
import * as DevGen from '../actions/dev-gen'
import * as ConfigGen from '../actions/config-gen'
import {isMobile} from '../constants/platform'
import {hookMiddleware} from './hook-middleware'

let theStore: Store<any, any>

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
let lastError = new Error('')

const errorCatching = () => next => action => {
  try {
    return next(action)
  } catch (error) {
    // Don't let the same error keep getting caught
    if (lastError.message === (error as Error).message) {
      return
    }
    lastError = error as Error
    logger.warn(`Caught a middleware exception`)
    logger.debug(`Caught a middleware exception`, error)

    try {
      crashHandler(error) // don't let this thing crash us forever
    } catch (_) {}
  }
}

export const sagaMiddleware = (__DEV__ && global.DEBUGSagaMiddleware) || createSagaMiddleware(crashHandler)
// don't overwrite this on HMR
if (__DEV__) {
  global.DEBUGSagaMiddleware = sagaMiddleware
}

const freezeMiddleware = _store => next => action => next(Object.freeze(action))

const middlewares = [
  errorCatching,
  sagaMiddleware,
  ...(__DEV__ ? [freezeMiddleware] : []),
  ...(enableStoreLogging && loggerMiddleware ? [loggerMiddleware] : []),
  ...(enableActionLogging ? [actionLogger] : []),
  hookMiddleware,
]

if (__DEV__ && typeof window !== 'undefined') {
  global.DEBUGActionLoop = () => {
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

  return {
    runSagas,
    store,
  }
}
