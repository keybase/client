'use strict'
/* @flow */

import { createStore, applyMiddleware } from 'redux'
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import rootReducer from '../reducers'
import Immutable from 'immutable'

// Transform objects from Immutable on printing
const objToJS = (state) => {
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

// Only log if __DEV__
const loggerMiddleware = createLogger({
  /* eslint-disable no-undef */
  predicate: (getState, action) => __DEV__,
  /* eslint-enable no-undef */

  transformer: objToJS,
  actionTransformer: objToJS
})

const createStoreWithMiddleware = applyMiddleware(
  thunkMiddleware,
  loggerMiddleware
)(createStore)

export default function configureStore (initialState) {
  return createStoreWithMiddleware(rootReducer, initialState)
}
