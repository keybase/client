/* eslint-disable flowtype/require-valid-file-annotation */
// TODO
// dll
// noparse
// prefetch
// commonchunks plugin
// hints from analyzer
//happypack?
//
import getenv from 'getenv'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'
import DashboardPlugin from 'webpack-dashboard/plugin'

const isHot = getenv.boolish('HOT', false)
const isDev = process.env.NODE_ENV !== 'production'
const isShowingDashboard = !getenv.boolish('NO_SERVER', false)

// webpack dev server has issues serving mixed hot/not hot so we have to build this separately
const isJustMain = getenv.boolish('JUST_MAIN', false)

// const noSourceMaps = getenv.boolish('NO_SOURCE_MAPS', false)

// const HMRPrefix = [
// 'react-hot-loader/patch',
// 'webpack-dev-server/client?http://localhost:4000',
// 'webpack/hot/only-dev-server',
// ]
// const path = require('path')
// const {fileLoaderRule, isHot} = require('./webpack.common')

// const makeEntries = () => {
// return {
// // index: path.resolve(__dirname, '../renderer/index.js'),
// // launcher: path.resolve(__dirname, '../renderer/launcher.js'),
// // main: path.resolve(__dirname, '../app/index.js'),
// // 'remote-component-loader': path.resolve(__dirname, '../renderer/remote-component-loader.js'),
// }
// }

const makeRules = () => {
  const fileLoaderRule = {
    loader: 'file-loader',
    options: {
      name: '[name].[ext]',
    },
  }

  const babelRule = {
    loader: 'babel-loader',
    options: {
      // Have to do this or it'll inherit babelrcs from the root and pull in things we don't want
      babelrc: false,
      cacheDirectory: true,
      plugins: [
        ['babel-plugin-transform-builtin-extend', {globals: ['Error']}],
        'transform-flow-strip-types',
        'transform-object-rest-spread', // not supported by electron yet
        'babel-plugin-transform-class-properties', // not supported by electron yet
        'transform-es2015-destructuring', // due to a bug: https://github.com/babel/babel/pull/5469
      ],
      presets: [
        [
          'env',
          {
            debug: false,
            exclude: ['transform-regenerator'],
            modules: false,
            targets: {
              electron: '1.6.10',
            },
            useBuiltIns: false,
          },
        ],
        'babel-preset-react',
      ],
    },
  }

  return [
    {
      include: path.resolve(__dirname, '../images/mock'),
      test: /\.jpg$/,
      use: [isDev ? fileLoaderRule : 'null-loader'],
    },
    {
      include: path.resolve(__dirname, '../images/icons'),
      test: /\.(flow|native\.js|gif|png|jpg)$/,
      use: ['null-loader'],
    },
    {
      exclude: /((node_modules\/(?!universalify|fs-extra))|\/dist\/)/,
      test: /\.jsx?$/,
      use: [babelRule],
    },
    {
      test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
      use: [fileLoaderRule],
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    },
  ]
}

const makeCommonPlugins = () => {
  const defines = {
    __DEV__: isDev,
    __HOT__: JSON.stringify(isHot),
    __SCREENSHOT__: false, // TODO
    __VERSION__: isDev ? JSON.stringify('Development') : undefined,
    'process.env.NODE_ENV': isDev ? JSON.stringify('development') : JSON.stringify('production'),
  }

  console.warn('Injecting defines: ', defines)
  const definePlugin = [new webpack.DefinePlugin(defines)]

  return [...definePlugin].filter(Boolean)
}

const commonConfig = {
  bail: true,
  cache: true,
  devServer: {
    compress: true,
    contentBase: path.resolve(__dirname, 'dist'),
    hot: isHot,
    lazy: false,
    overlay: true,
    port: 4000,
    publicPath: 'http://localhost:4000/dist/',
    quiet: false,
    stats: {
      colors: true,
    },
  },
  module: {
    rules: makeRules(),
  },
  node: {
    __dirname: true,
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: isHot ? 'http://localhost:4000/dist/' : '../dist/',
  },
  plugins: makeCommonPlugins(),
  resolve: {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  },
}

const mainThreadConfig = merge(commonConfig, {
  entry: {
    main: path.resolve(__dirname, 'app/index.js'),
  },
  name: 'mainThread',
  target: 'electron-main',
})

const makeRenderPlugins = () => {
  const dashboardPlugin = isShowingDashboard ? [new DashboardPlugin()] : []
  const hmrPlugin = isHot ? [new webpack.HotModuleReplacementPlugin(), new webpack.NamedModulesPlugin()] : []
  const noEmitOnErrorsPlugin = [new webpack.NoEmitOnErrorsPlugin()]

  const dllPlugin = isDev
    ? [
        new webpack.DllReferencePlugin({
          manifest: path.resolve(__dirname, 'dll/vendor-manifest.json'),
        }),
      ]
    : []

  return [...dashboardPlugin, ...hmrPlugin, ...noEmitOnErrorsPlugin, ...dllPlugin].filter(Boolean)
}

const HMREntries = isHot
  ? [
      'react-hot-loader/patch',
      'webpack-dev-server/client?http://localhost:4000',
      'webpack/hot/only-dev-server',
    ]
  : []

const renderThreadConfig = merge(commonConfig, {
  dependencies: ['vendor'],
  devtool: undefined, // 'cheap-module-eval-source-map',
  entry: {
    index: [...HMREntries, path.resolve(__dirname, 'renderer/index.js')],
    launcher: [...HMREntries, path.resolve(__dirname, 'renderer/launcher.js')],
    'remote-component-loader': [
      ...HMREntries,
      path.resolve(__dirname, 'renderer/remote-component-loader.js'),
    ],
  },
  name: 'renderThread',
  plugins: makeRenderPlugins(),
  target: 'electron-renderer',
})

const dllConfig = {
  entry: [
    './markdown/parser',
    'emoji-mart',
    'framed-msgpack-rpc',
    'immutable',
    'inline-style-prefixer',
    'lodash',
    'lodash.curry',
    'lodash.debounce',
    'material-ui',
    'material-ui/svg-icons',
    'moment',
    'prop-types',
    'qrcode-generator',
    'react-base16-styling',
    'react-dom',
    'react-list',
    'react-redux',
    'react-virtualized',
    'recompose',
    'redux',
    'redux-devtools-instrument',
    'redux-devtools-log-monitor',
    'redux-logger',
    'redux-saga',
    'semver',
  ],
  name: 'vendor',
  output: {
    filename: 'dll.vendor.js',
    library: 'vendor',
    path: path.resolve(__dirname, 'dist/dll'),
  },
  plugins: [
    new webpack.DllPlugin({
      name: 'vendor',
      path: path.resolve(__dirname, 'dll/vendor-manifest.json'),
    }),
  ],
  target: 'electron-renderer',
}

const config = isJustMain ? mainThreadConfig : [mainThreadConfig, renderThreadConfig, dllConfig]
// const override = {}

// const config = merge(commonConfig, override)

// console.log(JSON.stringify(config, null, 2))

export default config
