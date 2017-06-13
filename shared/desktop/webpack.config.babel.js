/* eslint-disable flowtype/require-valid-file-annotation */
/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 * if isDumb we render just the dumb sheet
 * is isVisDiff we render screenshots
 */
import DashboardPlugin from 'webpack-dashboard/plugin'
import UglifyJSPlugin from 'uglifyjs-webpack-plugin'
import getenv from 'getenv'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'

// External parameters which control the config
const isDev = process.env.NODE_ENV !== 'production'
const flags = {
  // webpack dev server has issues serving mixed hot/not hot so we have to build non-hot things separately
  isBeforeHot: getenv.boolish('BEFORE_HOT', false),
  isDev,
  isDumb: getenv.boolish('DUMB', false),
  isHot: getenv.boolish('HOT', false),
  isShowingDashboard: !getenv.boolish('NO_SERVER', !isDev),
  isVisDiff: getenv.boolish('VISDIFF', false),
}

console.log('Flags: ', flags)

// The common config all other derive from
const makeCommonConfig = () => {
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
        // Don't include large mock images in a prod build
        include: path.resolve(__dirname, '../images/mock'),
        test: /\.jpg$/,
        use: [flags.isDev ? fileLoaderRule : 'null-loader'],
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
      __DEV__: flags.isDev,
      __HOT__: flags.isHot,
      __SCREENSHOT__: flags.isVisDiff,
      __VERSION__: flags.isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
      'process.env.NODE_ENV': flags.isDev ? JSON.stringify('development') : JSON.stringify('production'),
    }
    console.warn('Injecting defines: ', defines)
    const definePlugin = [new webpack.DefinePlugin(defines)]

    const uglifyPlugin = flags.isDev
      ? []
      : [
          new UglifyJSPlugin({
            comments: false,
            sourceMaps: true,
          }),
        ]

    return [...definePlugin, ...uglifyPlugin].filter(Boolean)
  }

  // If we use the hot server it pulls in this config
  const devServer = {
    compress: false,
    contentBase: path.resolve(__dirname, 'dist'),
    hot: flags.isHot,
    lazy: false,
    overlay: true,
    port: 4000,
    publicPath: 'http://localhost:4000/dist/',
    quiet: false,
    stats: {
      colors: true,
    },
  }

  return {
    bail: true,
    cache: flags.isDev,
    devServer,
    module: {
      rules: makeRules(),
    },
    node: {
      __dirname: true,
    },
    output: {
      filename: '[name].bundle.js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: flags.isHot ? 'http://localhost:4000/dist/' : '../dist/',
    },
    plugins: makeCommonPlugins(),
    resolve: {
      extensions: ['.desktop.js', '.js', '.jsx', '.json', '.flow'],
    },
  }
}

const makeMainThreadConfig = () => {
  const makeEntries = () => {
    if (flags.isVisDiff) {
      return {
        'render-visdiff': path.resolve(__dirname, 'test/render-visdiff.js'),
      }
    } else {
      return {
        main: path.resolve(__dirname, 'app/index.js'),
      }
    }
  }

  return merge(commonConfig, {
    entry: makeEntries(),
    name: 'mainThread',
    target: 'electron-main',
  })
}

const makeRenderThreadConfig = () => {
  const makeRenderPlugins = () => {
    // Visual dashboard to see what the hot server is doing
    const dashboardPlugin = flags.isShowingDashboard ? [new DashboardPlugin()] : []
    // Allow hot module reload when editing files
    const hmrPlugin = flags.isHot && flags.isDev
      ? [new webpack.HotModuleReplacementPlugin(), new webpack.NamedModulesPlugin()]
      : []
    // Don't spit out errors while building
    const noEmitOnErrorsPlugin = flags.isDev ? [new webpack.NoEmitOnErrorsPlugin()] : []
    // Put common code between the entries into a sep. file
    const commonChunksPlugin = flags.isDev && !flags.isVisDiff
      ? [
          new webpack.optimize.CommonsChunkPlugin({
            filename: 'common-chunks.js',
            minChunks: 2,
            name: 'common-chunks',
          }),
        ]
      : []

    // Put our vendored stuff into its own thing
    const dllPlugin = flags.isDev && !flags.isVisDiff
      ? [
          new webpack.DllReferencePlugin({
            manifest: path.resolve(__dirname, 'dll/vendor-manifest.json'),
          }),
        ]
      : []

    return [
      ...dashboardPlugin,
      ...hmrPlugin,
      ...noEmitOnErrorsPlugin,
      ...dllPlugin,
      ...commonChunksPlugin,
    ].filter(Boolean)
  }

  // Have to inject some additional code if we're using HMR
  const HMREntries = flags.isHot && flags.isDev
    ? [
        'react-hot-loader/patch',
        'webpack-dev-server/client?http://localhost:4000',
        'webpack/hot/only-dev-server',
      ]
    : []

  const makeEntries = () => {
    if (flags.isVisDiff) {
      return {
        visdiff: path.resolve(__dirname, '../test/render-dumb-sheet.js'),
      }
    } else if (flags.isDumb) {
      return {
        index: [...HMREntries, path.resolve(__dirname, 'renderer/dumb.js')],
      }
    } else
      return {
        index: [...HMREntries, path.resolve(__dirname, 'renderer/index.js')],
        launcher: [...HMREntries, path.resolve(__dirname, 'renderer/launcher.js')],
        'remote-component-loader': [
          ...HMREntries,
          path.resolve(__dirname, 'renderer/remote-component-loader.js'),
        ],
      }
  }

  return merge(commonConfig, {
    dependencies: flags.isDev && !flags.isVisDiff ? ['vendor'] : undefined,
    // Sourcemaps, eval is very fast, but you might want something else if you want to see the original code
    devtool: flags.isVisDiff ? undefined : flags.isDev ? 'eval' : 'source-map',
    entry: makeEntries(),
    name: 'renderThread',
    plugins: makeRenderPlugins(),
    target: 'electron-renderer',
  })
}

const makeDllConfig = () => {
  return {
    // This list came from looking at the webpack analyzer and choosing the largest / slowest items
    entry: [
      './markdown/parser',
      'emoji-mart',
      'framed-msgpack-rpc',
      'immutable',
      'inline-style-prefixer',
      'lodash',
      'lodash.curry',
      'lodash.debounce',
      'material-ui/svg-icons',
      'material-ui/Popover',
      'material-ui/FontIcon',
      'material-ui/List',
      'material-ui/styles/spacing',
      'material-ui/styles/getMuiTheme',
      'material-ui/styles/MuiThemeProvider',
      'moment',
      'prop-types',
      'qrcode-generator',
      'react',
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
      // Don't include all the moment locales
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    ],
    target: 'electron-renderer',
  }
}

const commonConfig = makeCommonConfig()
const mainThreadConfig = makeMainThreadConfig()
const renderThreadConfig = makeRenderThreadConfig()
const dllConfig = flags.isDev && !flags.isVisDiff && makeDllConfig()

// When we start the hot server we want to build the main/dll without hot reloading statically
const config = flags.isBeforeHot
  ? [mainThreadConfig, dllConfig]
  : [mainThreadConfig, renderThreadConfig, dllConfig].filter(Boolean)

export default config
