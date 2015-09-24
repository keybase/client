'use strict'
/* @flow */

const { createStore, applyMiddleware } = require('redux')
const thunkMiddleware = require('redux-thunk')
const createLogger = require('redux-logger')

const rootReducer = require('../reducers')

const loggerMiddleware = createLogger()

const createStoreWithMiddleware = applyMiddleware(
  thunkMiddleware,
  loggerMiddleware
)(createStore)

module.exports = function configureStore (initialState) {
  return createStoreWithMiddleware(rootReducer, initialState)
}
