import * as ConfigConstants from '../constants/config'
import * as ReduxToolKit from '@reduxjs/toolkit'
import logger from '../logger'
import {actionLogger} from './action-logger'
import {enableStoreLogging, enableActionLogging} from '../local-debug'
import {initListeners} from './configure-listeners'
import {isMobile} from '../constants/platform'
import {listenerMiddleware} from '../util/redux-toolkit'
import {reducers} from '../reducers'
import {type Store} from 'redux'

let theStore: Store<any, any>

export const getGlobalStore = () => theStore

const crashHandler = (error: any) => {
  if (__DEV__) {
    throw error
  }
  ConfigConstants.useConfigState.getState().dispatch.setGlobalError(error)
}

let loggerMiddleware: any
let lastError = new Error('')

// @ts-ignore
const errorCatching = () => next => action => {
  try {
    return next(action)
  } catch (error_) {
    const error = error_ as any
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

// @ts-ignore
const freezeMiddleware = _store => next => action => next(Object.freeze(action))

const middlewares = [
  listenerMiddleware.middleware,
  errorCatching,
  ...(__DEV__ ? [freezeMiddleware] : []),
  ...(enableStoreLogging && loggerMiddleware ? [loggerMiddleware] : []),
  ...(enableActionLogging ? [actionLogger] : []),
]

// don't setup listeners again
if (__DEV__ && !globalThis.DEBUGlistenersInited) {
  globalThis.DEBUGlistenersInited = false
}

export default function makeStore() {
  const store = ReduxToolKit.configureStore({
    devTools: false,
    middleware: () => middlewares,
    // @ts-ignore we prefer our typing to what the toolkit gives
    reducer: reducers,
  })
  // @ts-ignore
  theStore = store

  if (module.hot && !isMobile) {
    module.hot.accept('../reducers', () => {
      store.replaceReducer(require('../reducers').default)
    })
  }

  return {
    initListeners: () => {
      if (__DEV__) {
        if (globalThis.DEBUGlistenersInited) {
          console.log('Dev reloading not registering listeners again')
          return
        } else {
          globalThis.DEBUGlistenersInited = true
        }
      }
      // register our listeners
      initListeners()
      // start our 'forks'
      store.dispatch({type: 'config:initListenerLoops'})
    },
    store,
  }
}
