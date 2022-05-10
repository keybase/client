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

  console.error('Flags: ', {isDev, isHot})

  const makeRules = nodeThread => {
    const babelRule = {
      loader: 'babel-loader',
      options: {
        cacheDirectory: true,
        ignore: [/\.(native|ios|android)\.(ts|js)x?$/],
        plugins: [...(isHot && !nodeThread ? ['react-hot-loader/babel'] : [])],
        presets: [
          ['@babel/preset-env', {debug: false, modules: false, targets: {electron: '17.0.1'}}],
          '@babel/preset-typescript',
        ],
      },
    }

    return [
      {
        // Don't include large mock images in a prod build
        include: path.resolve(__dirname, '../images/mock'),
        test: /\.jpg$/,
        ...(isDev ? {type: 'asset/resource'} : {use: ['null-loader']}),
      },
      {
        include: path.resolve(__dirname, '../node_modules/@react-navigation/elements/lib/module/assets'),
        test: /\.(native\.js|gif|png|jpg)$/,
        use: ['null-loader'],
      },
      {
        include: path.resolve(__dirname, '../images/icons'),
        test: /\.(native\.js|gif|png|jpg)$/,
        use: ['null-loader'],
      },
      {
        exclude: /((node_modules\/(?!universalify|react-redux|redux-saga|react-gateway))|\/dist\/)/,
        test: /\.(ts|js)x?$/,
        use: [babelRule],
      },
      {
        test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
        type: 'asset/resource',
      },
      {
        include: path.resolve(__dirname, '../images/illustrations'),
        test: [/.*\.(gif|png)$/],
        type: 'asset/resource',
      },
      {
        include: path.resolve(__dirname, '../images/install'),
        test: [/.*\.(gif|png)$/],
        type: 'asset/resource',
      },
      {
        include: path.resolve(__dirname, '../images/releases'),
        test: [/.*\.(png)$/],
        type: 'asset/resource',
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
    const defines = {
      __DEV__: isDev,
      __HOT__: isHot,
      __STORYBOOK__: false,
      __STORYSHOT__: false,
      __VERSION__: isDev ? JSON.stringify('Development') : JSON.stringify(process.env.APP_VERSION),
    }
    console.warn('Injecting defines: ', defines)

    const alias = {
      'react-native$': 'react-native-web',
    }
    if (isHot) {
      // hot loader
      alias['react-dom'] = '@hot-loader/react-dom'
    }
    if (isDev) {
      // enable why did you render
      alias['react-redux'] = 'react-redux/dist/react-redux.js'
    }

    return {
      bail: true,
      context: path.resolve(__dirname, '..'),
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
        new webpack.IgnorePlugin({resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/}), // Skip a bunch of crap moment pulls in
        ...(isDev ? [] : [new webpack.IgnorePlugin({resourceRegExp: /^lodash$/})]), // Disallow entire lodash
      ],
      resolve: {
        alias,
        extensions: ['.desktop.js', '.desktop.tsx', '.web.js', '.js', '.jsx', '.tsx', '.ts', '.json'],
      },
      ...(isDev
        ? {}
        : {
            optimization: {
              minimizer: [
                // options from create react app: https://github.com/facebook/create-react-app/blob/master/packages/react-scripts/config/webpack.config.prod.js
                new TerserPlugin({
                  parallel: true,
                  terserOptions: {
                    parse: {ecma: 8},
                    compress: {
                      comparisons: false,
                      ecma: 5,
                      inline: 2,
                      warnings: false,
                    },
                    keep_fnames: true,
                    keep_classnames: true,
                    mangle: false,
                    output: {comments: false},
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
      new webpack.IgnorePlugin({resourceRegExp: /^react$/}),
    ],
    stats: {
      ...(isDev ? {} : {usedExports: false}), // ignore exports warnings as its mostly used in the render thread
    },
    target: 'electron-main',
  })

  const hmrPlugin = isHot && isDev ? [new webpack.HotModuleReplacementPlugin()] : []
  const makeHtmlName = name => `${name}${isDev ? '.dev' : ''}.html`
  const makeViewPlugins = names =>
    [
      ...hmrPlugin,
      // Map since we generate multiple html files
      ...names.map(
        name =>
          new HtmlWebpackPlugin({
            chunks: [name],
            filename: makeHtmlName(name),
            inject: false,
            isDev,
            name,
            templateContent: ({htmlWebpackPlugin}) => `
<!DOCTYPE html>
<html>
    <head>
        <title>${htmlWebpackPlugin.options.isDev ? 'Keybase DEV' : 'Keybase'}</title>
        <meta charset="utf-8" http-equiv="Content-Security-Policy" content="
    default-src 'none';
    object-src 'self';
    font-src 'self' ${htmlWebpackPlugin.options.isDev ? 'http://localhost:4000' : ''};
    media-src http://127.0.0.1:*;
    img-src 'self' data: http://127.0.0.1:* https://keybase.io/ https://pbs.twimg.com/ https://avatars.githubusercontent.com/ https://s3.amazonaws.com/keybase_processed_uploads/ ${
      htmlWebpackPlugin.options.isDev ? 'http://localhost:4000' : ''
    };
    style-src 'unsafe-inline';
    script-src ${
      htmlWebpackPlugin.options.isDev
        ? "file: http://localhost:4000 chrome-extension://react-developer-tools 'unsafe-eval'"
        : "'self' 'sha256-gBKeEkQtnPGkGBsS6cpgPBgpI3Z1LehhkqagsAKMxUE='"
    };
    connect-src http://127.0.0.1:* ${
      htmlWebpackPlugin.options.isDev ? 'ws://localhost:4000 http://localhost:4000' : ''
    };
        ">
    </head>
    <body>
        <div id="root">
            <div title="loading..." style="flex: 1;background-color: #f5f5f5"></div>
        </div>
        <div id="modal-root"></div>
        ${
          htmlWebpackPlugin.options.isDev
            ? ''
            : "<script>window.eval = global.eval = function () { throw new Error('Sorry, this app does not support window.eval().')}</script>"
        }
        ${htmlWebpackPlugin.files.js.map(js => `<script src="${js}"></script>`).join('\n')} </body>
</html>
              `,
          })
      ),
    ].filter(Boolean)

  // just keeping main in its old place
  const entryOverride = {main: 'desktop/renderer'}

  // multiple entries so we can chunk shared parts
  const entries = ['main', 'menubar', 'pinentry', 'unlock-folders', 'tracker2']
  const viewConfig = merge(commonConfig, {
    devServer: {
      compress: false,
      hot: isHot,
      port: 4000,
      devMiddleware: {
        publicPath: 'http://localhost:4000/dist',
      },
      client: {
        overlay: true,
        webSocketURL: {
          hostname: 'localhost',
          pathname: '/ws',
          port: 4000,
        },
      },
      static: {
        directory: path.resolve(__dirname, 'dist'),
        publicPath: '/dist',
      },
    },
    entry: entries.reduce((map, name) => {
      map[name] = `./${entryOverride[name] || name}/main.desktop.tsx`
      return map
    }, {}),
    externals: {
      ...(isDev ? {} : {}),
    },
    module: {rules: makeRules(false)},
    name: 'Keybase',
    ...(isHot
      ? {}
      : {
          optimization: {splitChunks: {chunks: 'all'}},
        }),
    plugins: makeViewPlugins(entries),
    target: 'web',
    node: false,
    // target: 'electron-renderer',
  })
  const preloadConfig = merge(commonConfig, {
    entry: {preload: `./desktop/renderer/preload.desktop.tsx`},
    module: {rules: makeRules(true)},
    name: 'Keybase',
    plugins: [],
    target: 'electron-preload',
  })

  return [nodeConfig, viewConfig, preloadConfig]
}

export default config
