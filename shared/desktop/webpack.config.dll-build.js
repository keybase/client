/* eslint-disable flowtype/require-valid-file-annotation */
var path = require('path')
var webpack = require('webpack')
const getenv = require('getenv')
const NO_SOURCE_MAPS = getenv.boolish('NO_SOURCE_MAPS', false)

module.exports = {
  bail: true,
  debug: true,
  devtool: NO_SOURCE_MAPS ? undefined : 'inline-eval-cheap-source-map',
  pathinfo: true,
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
    path: path.join(__dirname, 'dist', 'dll'),
    filename: 'dll.[name].js',
    library: '[name]',
  },
  plugins: [
    new webpack.DllPlugin({
      path: path.join(__dirname, 'dll', '[name]-manifest.json'),
      name: '[name]',
      context: path.resolve(__dirname, 'client'),
    }),
    new webpack.optimize.OccurenceOrderPlugin(),
  ],
  resolve: {
    root: path.resolve(__dirname, 'client'),
    modulesDirectories: ['node_modules'],
  },
}
