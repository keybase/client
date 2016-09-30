// @flow
import createLogger from 'redux-logger'
import createSagaMiddleware from 'redux-saga'
import storeEnhancer from './enhancer.platform'
import mainSaga from './configure-sagas'
import rootReducer from '../reducers'
import thunkMiddleware from 'redux-thunk'
import {Iterable} from 'immutable'
import {actionLogger} from './action-logger'
import {createStore} from 'redux'
import {closureCheck} from './closure-check'
import {enableStoreLogging, enableActionLogging, closureStoreCheck} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'

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

export default function configureStore (initialState: any) {
  const store = createStore(rootReducer, initialState, storeEnhancer(middlewares))

  if (module.hot) {
    // $FlowIssue
    module.hot.accept('../reducers', () => {
      store.replaceReducer(require('../reducers').default)
    })
  }

  sagaMiddleware.run(mainSaga)
  return store
}
