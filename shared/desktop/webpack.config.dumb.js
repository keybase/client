/* eslint-disable flowtype/require-valid-file-annotation */
const devConfig = require('./webpack.config.development')
const getenv = require('getenv')

const HOT = getenv.boolish('HOT', false)

const entry = HOT
  ? {
      index: [
        'react-hot-loader/patch',
        'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr',
        './desktop/renderer/dumb.js',
      ],
    }
  : devConfig.entry

const config = {
  ...devConfig,
  entry,
}

module.exports = config
