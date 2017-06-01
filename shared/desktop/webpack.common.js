/* eslint-disable flowtype/require-valid-file-annotation */
const getenv = require('getenv')
const path = require('path')

const fileLoaderRule = {
  loader: 'file-loader',
  options: {
    name: '[name].[ext]',
  },
}

const mockRule = {
  include: path.resolve(__dirname, '../images/mock'),
  test: /\.jpg$/,
  use: [fileLoaderRule],
}

const isHot = getenv.boolish('HOT', false)
const noSourceMaps = getenv.boolish('NO_SOURCE_MAPS', true)

const HMRUrl = 'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr'
const RHLPatch = 'react-hot-loader/patch'

module.exports = {
  HMRUrl,
  RHLPatch,
  fileLoaderRule,
  isHot,
  mockRule,
  noSourceMaps,
}
