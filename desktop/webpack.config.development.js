const webpack = require('webpack')
const webpackTargetElectronRenderer = require('webpack-target-electron-renderer')
const baseConfig = require('./webpack.config.base')
const config = Object.assign({}, baseConfig)
const getenv = require('getenv')
const UnusedFilesWebpackPlugin = require('unused-files-webpack-plugin').default
const DashboardPlugin = require('webpack-dashboard/plugin')

const USING_DLL = getenv.boolish('USING_DLL', false)
const NO_SERVER = getenv.boolish('NO_SERVER', false)
const NO_SOURCE_MAPS = getenv.boolish('NO_SOURCE_MAPS', false)
const defines = {
  '__DEV__': true,
  '__SCREENSHOT__': false,
  'process.env.NODE_ENV': JSON.stringify('development'),
  '__VERSION__': JSON.stringify('Development'),
}

console.warn('Injecting dev defines: ', defines)

config.debug = true
config.cache = true
config.devtool = NO_SOURCE_MAPS ? undefined : 'eval-source-map'
config.pathinfo = true
config.output.publicPath = 'http://localhost:4000/dist/'

// Uncomment below to figure out packaging bugs
// config.bail = true

config.plugins.push(new UnusedFilesWebpackPlugin({
  pattern: '../shared/**/*.js',
  globOptions: {
    ignore: [
      // Mobile stuff
      '../**/*.native.js',
      '../**/*.ios.js',
      '../**/*.android.js',
      // Flow stuff
      '../shared/constants/folders.js',
      '../shared/constants/types/flux.js',
      '../shared/constants/types/saga.js',
      '../shared/constants/reducer.js',
      '../shared/flow-typed/*.js',
      // Tests
      '../shared/test/**',
      // Misc
      '../shared/packager/wipe-cache.js',
      '../shared/dev/log-send/index.js',
    ],
  },
}))

if (!NO_SERVER) {
  config.plugins.push(new DashboardPlugin())
}

config.plugins.push(new webpack.optimize.OccurenceOrderPlugin())

if (getenv.boolish('HOT', false)) {
  config.plugins.push(new webpack.HotModuleReplacementPlugin())
}

config.plugins.push(
  new webpack.NoErrorsPlugin(),
  new webpack.DefinePlugin(defines)
)

if (USING_DLL) {
  config.plugins.push(
    new webpack.DllReferencePlugin({
      context: './renderer',
      manifest: require('./dll/vendor-manifest.json'),
    })
  )
}

if (getenv.boolish('HOT', false)) {
  config.entry.index = ['react-hot-loader/patch'].concat(config.entry.index)

  const HMR = 'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr'

  Object.keys(config.entry).forEach(k => {
    if (k !== 'main') { // node-only thread can't be hot loaded...
      config.entry[k] = [HMR].concat(config.entry[k]) // Note: all entry points need `if (module.hot) {module.hot.accept()}` to allow hot auto loads to work
    }
  })
}

if (USING_DLL) {
  // If we are running a hot server and using a DLL we want to be fast.
  // So don't waste time in building the main thread bundle in this webpack server
  delete config.entry.main
}

config.target = webpackTargetElectronRenderer(config)
module.exports = config
