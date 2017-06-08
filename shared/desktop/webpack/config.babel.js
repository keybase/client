/* eslint-disable flowtype/require-valid-file-annotation */
import getenv from 'getenv'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'

// const mockRule = {
// include: path.resolve(__dirname, '../images/mock'),
// test: /\.jpg$/,
// use: [fileLoaderRule],
// }

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

const fileLoaderRule = {
  loader: 'file-loader',
  options: {
    name: '[name].[ext]',
  },
}

const makeEntries = () => {
  return {
    // index: path.resolve(__dirname, '../renderer/index.js'),
    // launcher: path.resolve(__dirname, '../renderer/launcher.js'),
    main: path.resolve(__dirname, '../app/index.js'),
    // 'remote-component-loader': path.resolve(__dirname, '../renderer/remote-component-loader.js'),
  }
}

const makeRules = () => {
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
            debug: false, // TEMP messes up output to analyzer, put back
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
      test: /emoji-datasource.*\.(gif|png)$/,
      use: [fileLoaderRule],
    },
    {
      test: /\.ttf$/,
      use: [fileLoaderRule],
    },
    {
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    },
  ]
}

const makePlugins = () => {
  const defines = {
    __HOT__: JSON.stringify(isHot),
    __DEV__: isDev,
    __SCREENSHOT__: false, // TODO
    __VERSION__: isDev ? JSON.stringify('Development') : undefined,
    'process.env.NODE_ENV': isDev ? JSON.stringify('development') : JSON.stringify('production'),
  }

  console.warn('Injecting defines: ', defines)
  return [new webpack.DefinePlugin(defines)]
}

const commonConfig = {
  bail: true,
  entry: makeEntries(),
  module: {
    rules: makeRules(),
  },
  node: {
    __dirname: true,
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '../dist'),
    publicPath: 'http://localhost:4000/dist/',
  },
  plugins: makePlugins(),
  resolve: {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  },
}

const mainThreadConfig = merge(commonConfig, {
  target: 'electron-main',
})

const config = mainThreadConfig

// const override = {}

// const config = merge(commonConfig, override)

// console.log(JSON.stringify(config))

export default config
