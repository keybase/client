/* eslint-disable flowtype/require-valid-file-annotation */
const path = require('path')
const webpack = require('webpack')
const baseConfig = require('./webpack.config.base')
const getenv = require('getenv')
const UnusedFilesWebpackPlugin = require('unused-files-webpack-plugin').default
const DashboardPlugin = require('webpack-dashboard/plugin')

const USING_DLL = getenv.boolish('USING_DLL', false)
const NO_SERVER = getenv.boolish('NO_SERVER', false)
const NO_SOURCE_MAPS = getenv.boolish('NO_SOURCE_MAPS', false)
const HOT = getenv.boolish('HOT', false)

const defines = {
  __DEV__: true,
  __SCREENSHOT__: false,
  __VERSION__: JSON.stringify('Development'),
  'process.env.NODE_ENV': JSON.stringify('development'),
}

console.warn('Injecting dev defines: ', defines)

const mockRule = {
  include: path.resolve(__dirname, '../images/mock'),
  test: /\.jpg$/,
  use: [
    {
      loader: 'file-loader',
      options: {
        name: '[name].[ext]',
      },
    },
  ],
}

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

const maybeDashboardPlugin = NO_SERVER ? [] : [new DashboardPlugin()]
const maybeHMRPlugin = HOT ? [new webpack.HotModuleReplacementPlugin()] : []
const maybeDLLPlugin = USING_DLL
  ? [
      new webpack.DllReferencePlugin({
        context: './renderer',
        manifest: require('./dll/vendor-manifest.json'),
      }),
    ]
  : []

const HMRURL = 'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr'
const entry = HOT
  ? {
      index: ['react-hot-loader/patch', ...baseConfig.entry.index],
      ...Object.keys(baseConfig.entry)
        .map(k => {
          if (k === 'main') {
            if (USING_DLL) {
              // If we are running a hot server and using a DLL we want to be fast.
              // So don't waste time in building the main thread bundle in this webpack server
              return null
            }

            // node-only thread can't be hot loaded...
            return baseConfig.entry[k]
          } else {
            // Note: all entry points need `if (module.hot) {module.hot.accept()}` to allow hot auto loads to work
            return [HMRURL, ...baseConfig.entry[k]]
          }
        })
        .filter(Boolean),
    }
  : baseConfig.entry

const config = {
  ...baseConfig,
  cache: true,
  devtool: NO_SOURCE_MAPS ? undefined : 'cheap-module-source-map',
  entry,
  module: {
    ...baseConfig.module,
    rules: [mockRule, ...baseConfig.module.rules],
  },
  output: {
    ...baseConfig.output,
    publicPath: HOT ? 'http://localhost:4000/dist/' : '../dist/',
  },
  plugins: [
    ...baseConfig.plugins,
    unusedFilesPlugin,
    ...maybeDashboardPlugin,
    ...maybeHMRPlugin,
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin(defines),
    ...maybeDLLPlugin,
  ].filter(Boolean),
  target: 'electron-renderer',
}

module.exports = config
