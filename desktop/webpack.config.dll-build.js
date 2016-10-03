var path = require('path')
var webpack = require('webpack')

module.exports = {
  entry: {
    vendor: ['material-ui', 'react', 'lodash', 'immutable', 'material-ui/styles', 'material-ui/svg-icons', 'material-ui/FlatButton', 'material-ui/Popover', 'moment', 'lodash', 'html-entities', 'redux-saga', 'core-js', 'qrcode-generator', 'react-json-tree', 'redux'],
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
