/* eslint-disable flowtype/require-valid-file-annotation */
const baseConfig = require('./webpack.config.base')
const path = require('path')
const webpack = require('webpack')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

// set this to true temporarily to skip the optimization step
const noOptimize = false

const makeRules = () => {
  const mockRule = {
    include: path.resolve(__dirname, '../images/mock'),
    use: ['null-loader'],
  }

  return [mockRule, ...baseConfig.module.rules]
}

const makePlugins = () => {
  const uglifyPlugin = !noOptimize && [
    new UglifyJSPlugin({
      compressor: {
        booleans: true,
        cascade: true,
        comparisons: true,
        conditionals: true,
        dead_code: true,
        drop_console: false,
        drop_debugger: true,
        evaluate: true,
        hoist_funs: true,
        hoist_vars: false,
        if_return: true,
        join_vars: true,
        keep_fargs: true,
        keep_fnames: false,
        loops: true,
        negate_iife: true,
        properties: true,
        pure_funcs: null,
        pure_getters: false,
        sequences: true,
        unsafe: false,
        unused: true,
        warnings: false,
      },
      screw_ie8: true,
      sourceMaps: true,
      warnings: false,
    }),
  ]

  // __VERSION__ is injected by package.js
  const defines = {
    __DEV__: false,
    __SCREENSHOT__: false,
    'process.env.NODE_ENV': JSON.stringify('production'),
  }
  console.warn('Injecting production defines: ', defines)

  return [...baseConfig.plugins, new webpack.DefinePlugin(defines), ...(uglifyPlugin || [])].filter(Boolean)
}

const config = {
  ...baseConfig,
  bail: true,
  cache: false, // Electron exposes the module as 2 different things depending on the context....
  devtool: 'source-map',
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

if (noOptimize) {
  console.error('Skipping optimize step!')
}

module.exports = config
