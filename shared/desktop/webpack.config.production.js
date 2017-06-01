/* eslint-disable flowtype/require-valid-file-annotation */
const path = require('path')
const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)

const SKIP_OPTIMIZE = false
// __VERSION__ is injected by package.js
const defines = {
  __DEV__: false,
  __SCREENSHOT__: false,
  'process.env.NODE_ENV': JSON.stringify('production'),
}

console.warn('Injecting production defines: ', defines)

config.devtool = 'source-map'
config.output.publicPath = '../dist/'
config.cache = false // Electron exposes the module as 2 different things depending on the context....

config.module.rules.unshift({
  include: path.resolve(__dirname, '../images/mock'),
  use: ['null-loader'],
})

config.plugins.push(new webpack.DefinePlugin(defines))

if (!SKIP_OPTIMIZE) {
  const babelLoader = config.module.rules.find(l => l.use[0].loader === 'babel-loader')
  const babelOptions = babelLoader.use[0].options
  const envPreset = babelOptions.presets.find(p => p[0] === 'env')[1]

  // Need regenerator
  babelOptions.plugins.push('babel-plugin-transform-runtime')
  // Have to fall back to more transpiling so we can use ugilfy
  envPreset.targets.uglify = true
  envPreset.useBuiltIns = false
  // Allow all uglify targets
  envPreset.exclude = []

  config.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
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
    })
  )
} else {
  console.error('Skipping optimize step!')
}

config.target = 'electron-renderer'
config.bail = true
module.exports = config
