/* eslint-disable flowtype/require-valid-file-annotation */
const devConfig = require('./webpack.config.development')
const {isHot, HMRUrl, RHLPatch} = require('./webpack.common')

const entry = isHot
  ? {
      index: [RHLPatch, HMRUrl, './desktop/renderer/dumb.js'],
    }
  : devConfig.entry

const config = {
  ...devConfig,
  entry,
}

module.exports = config
