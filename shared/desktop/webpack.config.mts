/* Our bundler for the desktop app.
 * We build:
 * Electron main thread / render threads for the main window and remote windows (menubar, trackers, etc)
 */
import {merge} from 'webpack-merge'
import path from 'path'
import {rspack} from '@rspack/core'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import {ReactRefreshRspackPlugin} from '@rspack/plugin-react-refresh'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import type {Configuration, RuleSetRule, RspackPluginInstance, DevServer} from '@rspack/core'

const require = createRequire(import.meta.url)
const configPath = fileURLToPath(import.meta.url)
const __dirname = path.dirname(configPath)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(__dirname, 'dist')
const babelConfigPath = path.resolve(rootDir, 'babel.config.js')
const nullModulePath = path.resolve(__dirname, '../null-module.js')
const ignoredModules = require('../ignored-modules') as Array<string>
const elecVersion = (require('../package.json') as {devDependencies: {electron: string}}).devDependencies
  .electron
// true if you want to debug unused code. This makes single chunks so you can grep for 'unused harmony' in the output in desktop/dist
const debugUnusedChunks = false
const evalDevtools = false
const debugWebpack = debugUnusedChunks || evalDevtools || !!process.env['DEBUG_WEBPACK']
const devServerPort = 4000
const devServerDistPath = '/dist'
const devServerURL = `http://localhost:${devServerPort}/`
const devServerDistURL = `http://localhost:${devServerPort}${devServerDistPath}/`
const remoteDebugURL = 'http://localhost:8097'
const nullLoadedAssetDirectories = [
  path.resolve(
    __dirname,
    '../node_modules/@react-navigation/native-stack/node_modules/@react-navigation/elements/lib/module/assets'
  ),
  path.resolve(__dirname, '../node_modules/@react-navigation/elements/lib/module/assets'),
  path.resolve(__dirname, '../images/icons'),
]
const resourceAssetDirectories = [
  path.resolve(__dirname, '../images'),
  path.resolve(__dirname, '../images/illustrations'),
  path.resolve(__dirname, '../images/install'),
]
const entryOverride: Record<string, string> = {main: 'desktop/renderer', remote: 'desktop/remote'}
const viewEntries = debugUnusedChunks ? ['main'] : ['main', 'remote']

type DesktopConfiguration = Configuration & {
  devServer?: DevServer
}

const logWebpackDebug = (...args: Array<unknown>) => {
  if (debugWebpack) {
    console.error(...args)
  }
}

if (debugWebpack) {
  logWebpackDebug('*** Webpack debugging on! ***', {debugUnusedChunks, evalDevtools})
}

const makeAlias = (): Record<string, string | false> => {
  // Sort longest-first so subpath entries (e.g. 'foo/bar') are inserted into
  // the alias object before their parent package ('foo'). webpack's enhanced-resolve
  // checks aliases in insertion order and uses the first match; a shorter prefix
  // like 'foo' would otherwise intercept 'foo/bar' and append '/bar' to the
  // null-module path, producing a non-existent path.
  const sortedModules = [...ignoredModules].sort((a, b) => b.length - a.length)
  const alias = sortedModules.reduce<Record<string, string | false>>(
    (acc, name: string) => {
      acc[name] = nullModulePath
      return acc
    },
    {
      'react-native$': 'react-native-web',
      'react-native-reanimated': false,
      'react-native/Libraries/Image/resolveAssetSource': nullModulePath,
    }
  )

  // Override the null-module for packages that need a real stub on desktop.
  // These are in native-only-modules (so Jest gets an empty stub) but webpack
  // needs proper exports so renderer code (e.g. @react-navigation/elements) works.
  alias['react-native-safe-area-context'] = path.resolve(__dirname, './stubs/react-native-safe-area-context.js')
  alias['@react-native-picker/picker'] = path.resolve(__dirname, './stubs/react-native-picker.js')

  return alias
}

const makeDefineValues = (isDev: boolean, isHot: boolean, isProfile: boolean, fileSuffix: string) => ({
  __FILE_SUFFIX__: JSON.stringify(fileSuffix),
  __PROFILE__: isProfile,
  __DEV__: isDev,
  __HOT__: isHot,
  __VERSION__: isDev ? JSON.stringify('Development') : JSON.stringify(process.env['APP_VERSION']),
  isMobile: JSON.stringify(false),
  isElectron: JSON.stringify(true),
  isAndroid: JSON.stringify(false),
  isIOS: JSON.stringify(false),
})

const makeBabelLoader = (
  isDev: boolean,
  isHot: boolean,
  nodeThread: boolean
): NonNullable<RuleSetRule['use']> => [
  {
    loader: 'babel-loader',
    options: {
      cacheDirectory: true,
      ignore: [/\.(native|ios|android)\.(ts|js)x?$/],
      plugins: [
        ['module-resolver', {alias: {'@': './'}}],
        ...(isHot && !nodeThread ? ['react-refresh/babel'] : []),
      ],
      presets: [
        ['@babel/preset-env', {debug: false, modules: false, targets: {electron: elecVersion}}],
        [
          '@babel/preset-react',
          {
            runtime: 'automatic',
            development: isDev,
          },
        ],
        '@babel/preset-typescript',
      ],
    },
  },
]

const makeRules = ({
  isDev,
  isHot,
  nodeThread,
}: {
  isDev: boolean
  isHot: boolean
  nodeThread: boolean
}): Array<RuleSetRule> => [
  {
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
  },
  {
    // Don't include large mock images in a prod build
    include: path.resolve(__dirname, '../images/mock'),
    test: /\.jpg$/,
    ...(isDev ? {type: 'asset/resource'} : {use: ['null-loader']}),
  },
  ...nullLoadedAssetDirectories.map(
    include =>
      ({
        include,
        test: /\.(native\.js|gif|png|jpg)$/,
        use: ['null-loader'],
      }) satisfies RuleSetRule
  ),
  {
    // Native-only files must never be parsed by webpack on desktop: they use @/ imports
    // that babel-module-resolver can't transform (babel ignores *.native.* files), so
    // webpack would see the raw @/ alias and fail to resolve it.
    test: /\.(native|ios|android)\.(ts|js)x?$/,
    use: ['null-loader'],
  },
  {
    exclude: [/\/dist\//, /\.(native|ios|android)\.(ts|js)x?$/],
    test: /\.(ts|js)x?$/,
    use: makeBabelLoader(isDev, isHot, nodeThread),
  },
  {
    test: [/emoji-datasource.*\.(gif|png)$/, /\.ttf$/],
    type: 'asset/resource',
  },
  ...resourceAssetDirectories.map(
    include =>
      ({
        include,
        test: [/.*\.(gif|png)$/],
        type: 'asset/resource',
      }) satisfies RuleSetRule
  ),
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

// Rspack's built-in SWC-based minifier (replaces terser-webpack-plugin). This only
// minifies — react-compiler still runs in babel-loader, never here.
const makeMinimizer = (isProfile: boolean) =>
  new rspack.SwcJsMinimizerRspackPlugin({
    minimizerOptions: {
      compress: {
        comparisons: false,
        ecma: 2020,
        inline: 2,
        ...(isProfile ? {keep_fnames: true, keep_classnames: true} : {}),
      },
      ...(isProfile ? {mangle: false} : {}),
      format: {comments: false},
    },
  })

const makeCommonOptimization = (isDev: boolean, isProfile: boolean): Configuration['optimization'] =>
  isDev
    ? undefined
    : {
        minimizer: [makeMinimizer(isProfile)],
      }

const makeRendererOptimization = (
  isDev: boolean,
  isProfile: boolean
): NonNullable<Configuration['optimization']> => ({
  ...(makeCommonOptimization(isDev, isProfile) ?? {}),
  splitChunks: {chunks: 'all'},
  ...(debugUnusedChunks ? {usedExports: true} : {}),
})

const joinCspSources = (sources: Array<string | false | undefined>) => sources.filter(Boolean).join(' ')

const makeCsp = (isDev: boolean) =>
  [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'object-src http://127.0.0.1:*',
    'frame-src http://127.0.0.1:*',
    `font-src ${joinCspSources(["'self'", isDev && devServerURL.slice(0, -1)])}`,
    'media-src http://127.0.0.1:*',
    `img-src ${joinCspSources([
      "'self'",
      'data:',
      'http://127.0.0.1:*',
      'https://keybase.io/',
      'https://pbs.twimg.com/',
      'https://avatars.githubusercontent.com/',
      'https://s3.amazonaws.com/keybase_processed_uploads/',
      isDev && devServerURL.slice(0, -1),
    ])}`,
    "style-src 'unsafe-inline'",
    `script-src ${joinCspSources(
      isDev ? ['file:', devServerURL.slice(0, -1), remoteDebugURL, "'unsafe-eval'"] : ["'self'"]
    )}`,
    `connect-src ${joinCspSources([
      'http://127.0.0.1:*',
      isDev && 'webpack:',
      isDev && `ws://localhost:${devServerPort}`,
      isDev && devServerURL.slice(0, -1),
      isDev && 'ws://localhost:8097',
    ])}`,
  ].join(';\n ')

const renderHtmlTemplate = ({
  files,
  isDev,
  name,
}: {
  files: {js?: Array<string>}
  isDev: boolean
  name: string
}) => `
<!DOCTYPE html>
<html>
    <head>
        <title>${isDev ? 'Keybase DEV' : 'Keybase'}</title>
        <meta charset="utf-8" http-equiv="Content-Security-Policy" content="${makeCsp(isDev)}">
    </head>
${isDev && name === 'main' ? `    <script src="${remoteDebugURL}"></script>` : ''}
    <body>
        <div id="root">
            <div title="loading..." style="flex: 1"></div>
        </div>
        <div id="modal-root"></div>
        ${(files.js ?? []).map((js: string) => `<script src="${js}"></script>`).join('\n')} </body>
</html>
`

const makeViewPlugins = ({
  fileSuffix,
  isDev,
  isHot,
  names,
}: {
  fileSuffix: string
  isDev: boolean
  isHot: boolean
  names: Array<string>
}): Array<RspackPluginInstance> => [
  ...(debugUnusedChunks
    ? [
        new rspack.optimize.LimitChunkCountPlugin({
          maxChunks: 1,
        }),
      ]
    : []),
  new rspack.DefinePlugin({
    global: 'globalThis',
    'process.env.NODE_DEBUG': JSON.stringify(process.env['NODE_DEBUG']),
  }),
  ...(isHot ? [new ReactRefreshRspackPlugin({forceEnable: true})] : []),
  ...names.map(
    (name: string) =>
      // html-webpack-plugin runs fine under Rspack, but its types reference webpack's
      // Compiler, so cast to Rspack's plugin instance type. HtmlRspackPlugin isn't a
      // drop-in here — it doesn't expose the templateContent files/options callback below.
      new HtmlWebpackPlugin({
        chunks: [name],
        filename: `${name}${fileSuffix}.html`,
        inject: false,
        isDev,
        name,
        templateContent: ({htmlWebpackPlugin}) =>
          renderHtmlTemplate({
            files: htmlWebpackPlugin.files,
            isDev: htmlWebpackPlugin.options.isDev,
            name,
          }),
      }) as unknown as RspackPluginInstance
  ),
]

const config = (_: unknown, {mode}: {mode?: 'development' | 'none' | 'production'}): Array<Configuration> => {
  const isDev = mode !== 'production'
  const isHot = isDev && !!process.env['HOT']
  const isProfile = !isDev && !!process.env['PROFILE']
  const fileSuffix = isDev ? '.dev' : isProfile ? '.profile' : ''
  const publicPath = isHot ? devServerDistURL : '../dist/'
  const alias = makeAlias()
  const defines = makeDefineValues(isDev, isHot, isProfile, fileSuffix)

  if (isProfile) {
    console.warn('*** Webpack profiling on ***')
  }

  logWebpackDebug('Flags:', {isDev, isHot, isProfile})
  logWebpackDebug('Detected electron from package.json:', elecVersion)
  logWebpackDebug('Injecting defines:', defines)

  const commonConfig: Configuration = {
    bail: true,
    cache: {
      type: 'persistent',
      buildDependencies: [
        configPath,
        babelConfigPath,
        path.resolve(rootDir, 'ignored-modules.js'),
        path.resolve(rootDir, 'native-only-modules.js'),
        path.resolve(__dirname, '../fonts/.font-build-stamp'),
      ],
    },
    context: rootDir,
    devtool: evalDevtools ? 'eval' : isDev ? 'cheap-module-source-map' : 'source-map',
    mode: isDev ? 'development' : 'production',
    node: false,
    optimization: makeCommonOptimization(isDev, isProfile),
    output: {
      filename: `[name]${fileSuffix}.bundle.js`,
      path: distDir,
      publicPath,
    },
    plugins: [
      new rspack.DefinePlugin(defines),
      new rspack.IgnorePlugin({resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/}),
      new rspack.IgnorePlugin({resourceRegExp: /^lodash$/}),
    ],
    resolve: {
      alias,
      extensions: ['.desktop.js', '.desktop.tsx', '.web.js', '.js', '.jsx', '.tsx', '.ts', '.json'],
    },
  }

  const nodeConfig: Configuration = merge<Configuration>(commonConfig, {
    entry: {node: './desktop/app/node.desktop.tsx'},
    module: {rules: makeRules({isDev, isHot, nodeThread: true})},
    name: 'node',
    plugins: [
      // Ensure the view layer doesn't bleed into the node layer
      new rspack.IgnorePlugin({resourceRegExp: /^react$/}),
    ],
    stats: {
      usedExports: isDev ? undefined : false,
    },
    target: 'electron-main',
  })

  const viewConfig: DesktopConfiguration = merge<DesktopConfiguration>(commonConfig as DesktopConfiguration, {
    devServer: {
      // The renderer HTML is loaded from disk over file://, so its <script> request
      // for the bundle is cross-origin/no-cors. Rspack's dev-server host + cross-origin
      // checks 403 that by default (webpack-dev-server did not); 'all' disables them.
      allowedHosts: 'all',
      compress: false,
      hot: isHot,
      liveReload: false,
      port: devServerPort,
      devMiddleware: {
        publicPath: devServerDistURL.slice(0, -1),
        writeToDisk: true,
      },
      client: {
        overlay: true,
        webSocketURL: {
          hostname: 'localhost',
          pathname: '/ws',
          port: devServerPort,
        },
      },
      static: [{directory: rootDir, publicPath: '/', watch: false}],
    },
    entry: viewEntries.reduce<Record<string, string>>((map, name: string) => {
      map[name] = `./${entryOverride[name] || name}/main.desktop.tsx`
      return map
    }, {}),
    module: {rules: makeRules({isDev, isHot, nodeThread: false})},
    name: 'renderer',
    ...(isHot
      ? {}
      : {
          optimization: makeRendererOptimization(isDev, isProfile),
        }),
    plugins: makeViewPlugins({fileSuffix, isDev, isHot, names: viewEntries}),
    resolve: {
      alias: {
        ...alias,
        'path-parse': false,
      },
      fallback: {process: false, url: false},
    },
    target: 'web',
  })
  const preloadConfig: Configuration = merge<Configuration>(commonConfig, {
    entry: {preload: `./desktop/renderer/preload.desktop.tsx`},
    module: {rules: makeRules({isDev, isHot, nodeThread: true})},
    name: 'preload',
    plugins: [],
    target: 'electron-preload',
  })

  return [nodeConfig, viewConfig, preloadConfig]
}

export default config
