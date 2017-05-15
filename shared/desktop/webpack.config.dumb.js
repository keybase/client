/* eslint-disable flowtype/require-valid-file-annotation */
const devConfig = require('./webpack.config.development')
const getenv = require('getenv')

const config = Object.assign({}, devConfig)

if (getenv.boolish('HOT', false)) {
  config.entry.index = ['react-hot-loader/patch'].concat(['./desktop/renderer/dumb.js'])
  config.entry.main = []
}

module.exports = config
