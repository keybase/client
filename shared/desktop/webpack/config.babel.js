/* eslint-disable flowtype/require-valid-file-annotation */
// TODO commonchunks plugin
// hmr
// noparse
// dsashboard
// dll
// new webpack.NoEmitOnErrorsPlugin(),
// prefetch
// hints from analyzer
// hmr entries
//
//
import getenv from 'getenv'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'

const isHot = getenv.boolish('HOT', false)
const isDev = process.env.NODE_ENV !== 'production'

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
      include: path.resolve(__dirname, '../../images/mock'),
      test: /\.jpg$/,
      use: [isDev ? fileLoaderRule : 'null-loader'],
    },
    {
      include: path.resolve(__dirname, '../../images/icons'),
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
  // entry: makeEntries(),
  module: {
    rules: makeRules(),
  },
  node: {
    __dirname: true,
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '../dist'),
    publicPath: isHot ? 'http://localhost:4000/dist/' : '../dist/',
  },
  plugins: makeCommonPlugins(),
  resolve: {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  },
}

const mainThreadConfig = merge(commonConfig, {
  entry: {
    main: path.resolve(__dirname, '../app/index.js'),
  },
  name: 'mainThread',
  target: 'electron-main',
})

const makeRenderPlugins = () => {
  const hmrPlugin = isHot ? [new webpack.HotModuleReplacementPlugin(), new webpack.NamedModulesPlugin()] : []
  const noEmitOnErrorsPlugin = [new webpack.NoEmitOnErrorsPlugin()]
  return [...hmrPlugin, ...noEmitOnErrorsPlugin].filter(Boolean)
}

const renderThreadConfig = merge(commonConfig, {
  devtool: undefined, // 'cheap-module-eval-source-map',
  entry: {
    index: path.resolve(__dirname, '../renderer/index.js'),
    launcher: path.resolve(__dirname, '../renderer/launcher.js'),
    'remote-component-loader': path.resolve(__dirname, '../renderer/remote-component-loader.js'),
  },
  name: 'renderThread',
  plugins: makeRenderPlugins(),
  target: 'electron-renderer',
  // dependencies: ['vendor'],
})

const config = [mainThreadConfig, renderThreadConfig]
// const override = {}

// const config = merge(commonConfig, override)

console.log(JSON.stringify(config, null, 2))

export default config
