/* eslint-disable flowtype/require-valid-file-annotation */
const devConfig = require('./webpack.config.development')
const getenv = require('getenv')

const config = Object.assign({}, devConfig)

if (getenv.boolish('HOT', false)) {
  config.entry = {
    index: [
      'react-hot-loader/patch',
      'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr',
    ].concat(['./desktop/renderer/dumb.js']),
  }
}

module.exports = config
