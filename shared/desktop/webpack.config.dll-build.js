/* eslint-disable flowtype/require-valid-file-annotation */
const path = require('path')
const webpack = require('webpack')
const getenv = require('getenv')

const NO_SOURCE_MAPS = getenv.boolish('NO_SOURCE_MAPS', false)

const dllPlugin = new webpack.DllPlugin({
  context: path.resolve(__dirname, 'client'),
  name: '[name]',
  path: path.join(__dirname, 'dll', '[name]-manifest.json'),
})

const config = {
  bail: true,
  devtool: NO_SOURCE_MAPS ? undefined : 'inline-eval-cheap-source-map',
  entry: {
    vendor: [
      'core-js',
      'html-entities',
      'immutable',
      'lodash',
      'material-ui',
      'material-ui/FlatButton',
      'material-ui/Popover',
      'material-ui/styles',
      'material-ui/svg-icons',
      'moment',
      'qrcode-generator',
      'react',
      'react-json-tree',
      'redux',
      'redux-saga',
    ],
  },
  output: {
    filename: 'dll.[name].js',
    library: '[name]',
    path: path.join(__dirname, 'dist', 'dll'),
  },
  plugins: [dllPlugin],
  resolve: {
    modules: [path.resolve(__dirname, 'client'), 'node_modules'],
  },
}

module.exports = config
