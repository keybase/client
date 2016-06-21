const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)

const defines = {
  '__DEV__': true,
  '__TEST__': true,
  '__SCREENSHOT__': false,
  'process.env.NODE_ENV': JSON.stringify('development'),
  '__VERSION__': JSON.stringify('Development'),
}

config.entry = {
  test: ['./shared/test/index.js'],
}
config.devtool = 'source-map'

config.plugins.push(
  new webpack.optimize.OccurenceOrderPlugin(),
  new webpack.DefinePlugin(defines)
)

config.target = 'node'

module.exports = config
