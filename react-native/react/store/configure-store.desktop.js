'use strict'
/* @flow */

import { createStore, compose, applyMiddleware } from 'redux'
import { devTools } from 'redux-devtools'
import thunkMiddleware from 'redux-thunk'
import createLogger from 'redux-logger'
import rootReducer from '../reducers'

const loggerMiddleware = createLogger()

const createStoreWithMiddleware = compose(
  applyMiddleware(thunkMiddleware, loggerMiddleware),
  devTools()
)(createStore)

export default function configureStore (initialState) {
  return createStoreWithMiddleware(rootReducer, initialState)
}
