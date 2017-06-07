/* eslint-disable flowtype/require-valid-file-annotation */
const webpack = require('webpack')
const path = require('path')
const {fileLoaderRule, isHot} = require('./webpack.common')

const makePlugins = () => {
  const defines = {
    __HOT__: JSON.stringify(isHot),
  }

  console.warn('Injecting defines: ', defines)
  return [new webpack.DefinePlugin(defines)]
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

const makeEntries = () => {
  return {
    index: ['./desktop/renderer/index.js'],
    launcher: ['./desktop/renderer/launcher.js'],
    main: ['./desktop/app/index.js'],
    'remote-component-loader': ['./desktop/renderer/remote-component-loader.js'],
  }
}

const config = {
  entry: makeEntries(),
  module: {
    rules: makeRules(),
  },
  node: {
    __dirname: true,
  },
  output: {
    filename: '[name].bundle.js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, 'dist'),
  },
  plugins: makePlugins(),
  resolve: {
    extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
  },
}

module.exports = config
