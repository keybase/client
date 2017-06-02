/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const {mockRule} = require('./webpack.common')

const makePlugins = () => {
  const defines = {
    __DEV__: true,
    __SCREENSHOT__: true,
    __VERSION__: JSON.stringify('Development'),
    'process.env.NODE_ENV': JSON.stringify('development'),
  }

  return [...baseConfig.plugins, new webpack.DefinePlugin(defines)]
}

const makeRules = () => {
  return [mockRule, ...baseConfig.module.rules]
}

const config = {
  ...baseConfig,
  entry: {
    'render-visdiff': ['./desktop/test/render-visdiff.js'],
    visdiff: ['./test/render-dumb-sheet.js'],
  },
  module: {
    ...baseConfig.module,
    rules: makeRules(),
  },
  output: {
    ...baseConfig.output,
    publicPath: '../dist/',
  },
  plugins: makePlugins(),
  target: 'electron-renderer',
}

module.exports = config
