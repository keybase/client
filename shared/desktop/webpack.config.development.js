/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const getenv = require('getenv')
const UnusedFilesWebpackPlugin = require('unused-files-webpack-plugin').default
const DashboardPlugin = require('webpack-dashboard/plugin')
const {isHot, HMRUrl, RHLPatch, noSourceMaps, mockRule} = require('./webpack.common')

const isUsingDLL = getenv.boolish('USING_DLL', false)
const noServer = getenv.boolish('NO_SERVER', false)

const makePlugins = () => {
  const unusedFilesPlugin = new UnusedFilesWebpackPlugin({
    globOptions: {
      ignore: [
        // Mobile stuff
        '../**/*.native.js',
        '../**/*.ios.js',
        '../**/*.android.js',
        // Flow stuff
        '../constants/folders.js',
        '../constants/types/flux.js',
        '../constants/types/saga.js',
        '../constants/reducer.js',
        '../flow-typed/*.js',
        // Tests
        '../test/**',
        // Misc
        '../packager/wipe-cache.js',
        '../dev/log-send/index.js',
      ],
    },
    pattern: './shared/**/*.js',
  })

  const dashboardPlugin = !noServer && [new DashboardPlugin()]
  const hmrPlugin = isHot && [new webpack.HotModuleReplacementPlugin()]
  const dllPlugin = isUsingDLL && [
    new webpack.DllReferencePlugin({
      context: './renderer',
      manifest: require('./dll/vendor-manifest.json'),
    }),
  ]

  const defines = {
    __DEV__: true,
    __SCREENSHOT__: false,
    __VERSION__: JSON.stringify('Development'),
    'process.env.NODE_ENV': JSON.stringify('development'),
  }

  console.warn('Injecting dev defines: ', defines)

  return [
    ...baseConfig.plugins,
    unusedFilesPlugin,
    ...(dashboardPlugin || []),
    ...(hmrPlugin || []),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin(defines),
    ...(dllPlugin || []),
  ].filter(Boolean)
}

const makeRules = () => {
  return [mockRule, ...baseConfig.module.rules]
}

const makeEntries = () => {
  const oldEntries = baseConfig.entry
  if (!isHot) {
    return oldEntries
  }
  return Object.keys(baseConfig.entry).reduce((map, name) => {
    const oldEntry = oldEntries[name]

    if (name === 'index') {
      map[name] = [RHLPatch, ...oldEntry]
    } else if (name === 'main') {
      if (!isUsingDLL) {
        // If we are running a hot server and using a DLL we want to be fast.
        // So don't waste time in building the main thread bundle in this webpack server
        // node-only thread can't be hot loaded...
        map[name] = oldEntry
      }
    } else {
      // Note: all entry points need `if (module.hot) {module.hot.accept()}` to allow hot auto loads to work
      map[name] = [HMRUrl, ...oldEntry]
    }
    return map
  }, {})
}

const config = {
  ...baseConfig,
  cache: true,
  devtool: noSourceMaps ? undefined : 'cheap-module-source-map',
  entry: makeEntries(),
  module: {
    ...baseConfig.module,
    rules: makeRules(),
  },
  output: {
    ...baseConfig.output,
    publicPath: isHot ? 'http://localhost:4000/dist/' : '../dist/',
  },
  plugins: makePlugins(),
  target: 'electron-renderer',
}

module.exports = config
