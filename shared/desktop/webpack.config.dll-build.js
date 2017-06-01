/* eslint-disable flowtype/require-valid-file-annotation */
const path = require('path')
const webpack = require('webpack')
const {noSourceMaps} = require('./webpack.common')

const makePlugins = () => {
  const dllPlugin = new webpack.DllPlugin({
    context: path.resolve(__dirname, 'client'),
    name: '[name]',
    path: path.join(__dirname, 'dll', '[name]-manifest.json'),
  })
  return [dllPlugin]
}

const config = {
  bail: true,
  devtool: noSourceMaps ? undefined : 'inline-eval-cheap-source-map',
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
  plugins: makePlugins(),
  resolve: {
    modules: [path.resolve(__dirname, 'client'), 'node_modules'],
  },
}

module.exports = config
