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
const noSourceMaps = getenv.boolish('NO_SOURCE_MAPS', false)

const HMRPrefix = [
  'react-hot-loader/patch',
  'webpack-dev-server/client?http://localhost:4000',
  'webpack/hot/only-dev-server',
]

module.exports = {
  HMRPrefix,
  fileLoaderRule,
  isHot,
  mockRule,
  noSourceMaps,
}
