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
import {enableStoreLogging, enableActionLogging, closureStoreCheck} from '../local-debug'
import {globalError} from '../constants/config'
import {isMobile} from '../constants/platform'
import {convertToError} from '../util/errors'
import {setupLogger} from '../util/periodic-logger'

const logActionsImmediately = false

// Transform objects from Immutable on printing
const objToJS = ([prefix, state]) => {
  var newState = {}

  Object.keys(state).forEach(i => {
    if (Iterable.isIterable(state[i])) {
      newState[i] = state[i].toJS()
    } else {
      newState[i] = state[i]
    }
  })

  return [prefix, newState]
}

const logger = setupLogger('storeLogger', 100, logActionsImmediately, objToJS, 50)
let theStore: Store

const crashHandler = (error) => {
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

const loggerMiddleware: any = enableStoreLogging ? createLogger({
  actionTransformer: (...args) => {
    console.log('Action:', ...args)
    return null
  },
  collapsed: true,
  duration: true,
  logger: {
    error: () => {},
    log: () => {},
    warn: () => {},
  },
  stateTransformer: (...args) => {
    logger.log('State:', ...args)
    return null
  },
  titleFormatter: () => null,
}) : null

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
    } catch (_) {
    }
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

export default function configureStore (initialState: any) {
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
