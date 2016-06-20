const webpack = require('webpack')
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)

const defines = {
  '__DEV__': true,
  '__SCREENSHOT__': true,
  'process.env.NODE_ENV': JSON.stringify('development'),
  '__VERSION__': JSON.stringify('Development'),
}

config.entry = {
  'render-visdiff': ['./test/render-visdiff.js'],
  visdiff: ['./shared/test/render-dumb-sheet.js'],
}
config.plugins.push(
  new webpack.optimize.OccurenceOrderPlugin(),
  new webpack.DefinePlugin(defines)
)

config.target = webpackTargetElectronRenderer(config)
module.exports = config
