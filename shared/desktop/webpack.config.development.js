/* eslint-disable flowtype/require-valid-file-annotation */
const path = require('path')
const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const getenv = require('getenv')
const UnusedFilesWebpackPlugin = require('unused-files-webpack-plugin').default
const DashboardPlugin = require('webpack-dashboard/plugin')
const {isHot, HMRPrefix, noSourceMaps, mockRule} = require('./webpack.common')

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
  const hmrPlugin = isHot && [new webpack.HotModuleReplacementPlugin(), new webpack.NamedModulesPlugin()]
  const dllPlugin = isUsingDLL && [
    new webpack.DllReferencePlugin({
      manifest: path.resolve(__dirname, 'dll/vendor-manifest.json'),
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
      map[name] = [...HMRPrefix, ...oldEntry]
    } else if (name === 'main') {
      if (!isUsingDLL) {
        // If we are running a hot server and using a DLL we want to be fast.
        // So don't waste time in building the main thread bundle in this webpack server
        // node-only thread can't be hot loaded...
        map[name] = oldEntry
      }
    } else {
      // Note: all entry points need `if (module.hot) {module.hot.accept()}` to allow hot auto loads to work
      map[name] = [...HMRPrefix, ...oldEntry]
    }
    return map
  }, {})
}

const mainThreadConfig = {
  ...baseConfig,
  bail: true,
  devtool: undefined,
  entry: {
    main: ['./desktop/app/index.js'],
  },
  name: 'node-thread'
  output: {
    ...baseConfig.output,
    publicPath: 'http://localhost:4000/dist/',
  },
  plugins: makePlugins(),
  target: 'electron-main',
}

const dllConfig = {
  name: 'vendor',
  entry: [
    'qrcode-generator',
    'emoji-mart',
    'lodash',
    'material-ui',
    'moment',
    'react-dom',
    'semver',
    'prop-types',
    'inline-style-prefixer',
    'react-virtualized',
    'redux-logger',
    'lodash.debounce',
  ],
  output: {
    path: path.resolve(__dirname, 'dist/dll'),
    filename: 'dll.js',
    library: 'vendor_[hash]',
  },
  plugins: [
    new webpack.DllPlugin({
      name: 'vendor_[hash]',
      path: path.resolve(__dirname, 'dll/vendor-manifest.json'),
    }),
  ],
}

const devConfig = {
  ...baseConfig,
  cache: true,
  dependencies: ['vendor'],
  devtool: noSourceMaps ? undefined : 'cheap-module-source-map',
  entry: makeEntries(),
  module: {
    ...baseConfig.module,
    rules: makeRules(),
  },
  name: 'dev',
  output: {
    ...baseConfig.output,
    publicPath: isHot ? 'http://localhost:4000/dist/' : '../dist/',
  },
  plugins: makePlugins(),
  target: 'electron-renderer',
}

const config = [mainThreadConfig, dllConfig, devConfig]

module.exports = config
