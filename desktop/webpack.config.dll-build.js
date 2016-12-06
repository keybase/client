// @flow
var path = require('path')
var webpack = require('webpack')

module.exports = {
  bail: true,
  entry: {
    vendor: ['core-js', 'html-entities', 'immutable', 'lodash', 'material-ui', 'material-ui/FlatButton', 'material-ui/Popover', 'material-ui/styles', 'material-ui/svg-icons', 'moment', 'qrcode-generator', 'react', 'react-json-tree', 'redux', 'redux-saga'],
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
