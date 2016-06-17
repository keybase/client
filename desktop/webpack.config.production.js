const webpack = require('webpack')
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)

const SKIP_OPTIMIZE = false
// __VERSION__ is injected by package.js
const defines = {
  '__DEV__': false,
  '__SCREENSHOT__': false,
  'process.env.NODE_ENV': JSON.stringify('production'),
}

console.log('Injecting production defines: ', defines)

config.devtool = 'source-map'
config.output.publicPath = '/dist/'
config.cache = false // Electron exposes the module as 2 different things depending on the context....

config.plugins.push(
  new webpack.DefinePlugin(defines),
  new webpack.optimize.OccurenceOrderPlugin()
)

if (!SKIP_OPTIMIZE) {
  config.plugins.push(
    new webpack.optimize.UglifyJsPlugin({
      screw_ie8: true,
      warnings: false,
      compressor: {
        sequences: true,
        properties: true,
        dead_code: true,
        drop_debugger: true,
        unsafe: false,
        conditionals: true,
        comparisons: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        hoist_vars: false,
        if_return: true,
        join_vars: true,
        cascade: true,
        warnings: false,
        negate_iife: true,
        pure_getters: false,
        pure_funcs: null,
        drop_console: false,
        keep_fargs: true,
        keep_fnames: false,
      },
    }),
    new webpack.optimize.DedupePlugin()
  )
} else {
  console.error('Skipping optimize step!')
}

config.target = webpackTargetElectronRenderer(config)
config.bail = true
module.exports = config
