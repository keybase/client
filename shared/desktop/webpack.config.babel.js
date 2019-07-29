/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 */
import TerserPlugin from 'terser-webpack-plugin'
import merge from 'webpack-merge'
import path from 'path'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'

// When we start the hot server we want to build the main/dll without hot reloading statically
const config = (_, {mode}) => {
  const isDev = mode !== 'production'
  const isHot = isDev && !!process.env['HOT']
  const isStats = !!process.env['STATS']

  !isStats && console.error('Flags: ', {isDev, isHot})

  const makeRules = nodeThread => {
    const fileLoaderRule = {
      loader: 'file-loader',
      options: {name: '[name].[ext]'},
    }

    const babelRule = {
      loader: 'babel-loader',
      options: {
        cacheDirectory: true,
        ignore: [/\.(native|ios|android)\.(ts|js)x?$/],
        plugins: [...(isHot && !nodeThread ? ['react-hot-loader/babel'] : [])],
        presets: [
          ['@babel/preset-env', {debug: false, modules: false, targets: {electron: '5.0.7'}}],
          '@babel/preset-typescript',
        ],
      },
    }

    return [
      {
        // Don't include large mock images in a prod build
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
        exclude: /((node_modules\/(?!universalify|fs-extra|react-redux|redux-saga|react-gateway))|\/dist\/)/,
        test: /\.(ts|js)x?$/,
        use: [babelRule],
      },
      {
        test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
        use: [fileLoaderRule],
      },
      {
        include: path.resolve(__dirname, '../images/illustrations'),
        test: [/.*\.(gif|png)$/],
        use: [fileLoaderRule],
      },
      {
        include: path.resolve(__dirname, '../images/install'),
        test: [/.*\.(gif|png)$/],
        use: [fileLoaderRule],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ]
  }

  const publicPath = isHot ? 'http://localhost:4000/dist/' : '../dist/'

  const makeCommonConfig = () => {
    // If we use the hot server it pulls in this config
    const devServer = {
      compress: false,
      contentBase: path.resolve(__dirname, 'dist'),
      hot: isHot,
      lazy: false,
      overlay: true,
      port: 4000,
      publicPath: 'http://localhost:4000/dist/',
      quiet: false,
      stats: {colors: true},
    }

    const defines = {
      __DEV__: isDev,
      __HOT__: isHot,
      __STORYBOOK__: false,
      __STORYSHOT__: false,
      __VERSION__: isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
    }
    console.warn('Injecting defines: ', defines)

    return {
      bail: true,
      context: path.resolve(__dirname, '..'),
      devServer,
      devtool: isDev ? 'eval' : 'source-map',
      mode: isDev ? 'development' : 'production',
      node: false,
      output: {
        filename: `[name]${isDev ? '.dev' : ''}.bundle.js`,
        path: path.resolve(__dirname, 'dist'),
        // can be the same?
        publicPath,
      },
      plugins: [
        new webpack.DefinePlugin(defines), // Inject some defines
        new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/), // Skip a bunch of crap moment pulls in
      ],
      resolve: {
        ...(isHot
          ? {
              alias: {'react-dom': '@hot-loader/react-dom'},
            }
          : {}),
        extensions: ['.desktop.js', '.desktop.tsx', '.js', '.jsx', '.tsx', '.ts', '.json', '.flow'],
      },
      stats: {
        ...(isDev
          ? {}
          : {
              exclude: undefined,
              maxModules: Infinity,
              providedExports: true,
              usedExports: true,
            }),
      },
      ...(isDev
        ? {}
        : {
            optimization: {
              minimizer: [
                // options from create react app: https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpack.config.prod.js
                new TerserPlugin({
                  cache: true,
                  parallel: true,
                  sourceMap: true,
                  terserOptions: {
                    compress: {
                      comparisons: false,
                      ecma: 5,
                      inline: 2,
                      warnings: false,
                    },
                    output: {
                      comments: false,
                    },
                    // warnings: 'verbose', // uncomment to see more of what uglify is doing
                  },
                }),
              ],
            },
          }),
    }
  }

  const commonConfig = makeCommonConfig()
  const nodeConfig = merge(commonConfig, {
    entry: {node: './desktop/app/node.desktop.tsx'},
    module: {rules: makeRules(true)},
    name: 'node',
    plugins: [
      // blacklist common things from the main thread to ensure the view layer doesn't bleed into the node layer
      new webpack.IgnorePlugin(/^react$/),
    ],
    stats: {
      ...(isDev ? {} : {usedExports: false}), // ignore exports warnings as its mostly used in the render thread
    },
    target: 'electron-main',
  })

  const hmrPlugin = isHot && isDev ? [new webpack.HotModuleReplacementPlugin()] : []
  const template = path.join(__dirname, './renderer/index.html.template')
  const makeHtmlName = name => `${name}${isDev ? '.dev' : ''}.html`
  const makeViewPlugins = names =>
    [
      ...hmrPlugin,
      // Map since we generate multiple html files
      ...names.map(
        name =>
          new HtmlWebpackPlugin({
            // chunks: [name],
            filename: makeHtmlName(name),
            inject: false,
            isDev,
            name,
            template,
          })
      ),
    ].filter(Boolean)

  // just keeping main in its old place
  const entryOverride = {
    main: 'desktop/renderer',
  }

  const typeOverride = {
    main: 'tsx',
    menubar: 'tsx',
    pinentry: 'tsx',
    tracker2: 'tsx',
    'unlock-folders': 'tsx',
  }

  // multiple entries so we can chunk shared parts
  const entries = ['main', 'menubar', 'pinentry', 'unlock-folders', 'tracker2']
  const viewConfig = merge(commonConfig, {
    entry: entries.reduce((map, name) => {
      map[name] = `./${entryOverride[name] || name}/main.desktop.${typeOverride[name] || 'js'}`
      return map
    }, {}),
    module: {rules: makeRules(false)},
    name: 'Keybase',
    optimization: {splitChunks: {chunks: 'all'}},
    plugins: makeViewPlugins(entries),
    target: 'electron-renderer',
  })

  return [nodeConfig, viewConfig]
}

export default config
