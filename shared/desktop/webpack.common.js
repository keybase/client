/* eslint-disable flowtype/require-valid-file-annotation */
const getenv = require('getenv')
const path = require('path')

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
          debug: true,
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

const fileLoaderRule = {
  loader: 'file-loader',
  options: {
    name: '[name].[ext]',
  },
}

const mockRule = {
  include: path.resolve(__dirname, '../images/mock'),
  test: /\.jpg$/,
  use: [fileLoaderRule],
}

const isHot = getenv.boolish('HOT', false)
const noSourceMaps = getenv.boolish('NO_SOURCE_MAPS', true)

const HMRUrl = 'webpack-hot-middleware/client?path=http://localhost:4000/__webpack_hmr'
const RHLPatch = 'react-hot-loader/patch'

module.exports = {
  HMRUrl,
  RHLPatch,
  babelRule,
  fileLoaderRule,
  isHot,
  mockRule,
  noSourceMaps,
}
