'use strict'

const { combineReducers } = require('redux')
const login = require('./login')
const router = require('./router')

module.exports = combineReducers({
  login,
  router
})
