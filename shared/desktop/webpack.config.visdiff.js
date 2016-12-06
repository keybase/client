const webpack = require('webpack') // eslint-disable-line flowtype/require-valid-file-annotation
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
  'render-visdiff': ['./desktop/test/render-visdiff.js'],
  visdiff: ['./desktop/test/render-dumb-sheet.js'],
}
config.plugins.push(
  new webpack.optimize.OccurenceOrderPlugin(),
  new webpack.DefinePlugin(defines)
)

config.output.publicPath = '../dist/'

config.target = webpackTargetElectronRenderer(config)
module.exports = config
