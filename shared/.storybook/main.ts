import path from 'path'
import webpack from 'webpack'
import {createRequire} from 'module'
import {fileURLToPath} from 'url'
import type {StorybookConfig} from '@storybook/react-webpack5'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const nullModulePath = path.resolve(rootDir, 'null-module.js')
const ignoredModules = require('../ignored-modules') as Array<string>

const makeAliases = (): Record<string, string | false> => {
  // Sort longest-first: webpack checks in insertion order; longer prefixes must come first
  // so subpath entries (e.g. 'foo/bar') are matched before their parent package ('foo').
  const sortedModules = [...ignoredModules].sort((a, b) => b.length - a.length)
  const alias = sortedModules.reduce<Record<string, string | false>>((acc, name) => {
    acc[name] = nullModulePath
    return acc
  }, {})
  return {
    ...alias,
    'react-native$': 'react-native-web',
    'react-native-reanimated': false,
    'react-native/Libraries/Image/resolveAssetSource': nullModulePath,
    'react-native-safe-area-context': path.resolve(rootDir, 'desktop/stubs/react-native-safe-area-context.js'),
    '@react-native-picker/picker': path.resolve(rootDir, 'desktop/stubs/react-native-picker.js'),
    // electron stub MUST come before '@' (insertion order matters for webpack alias matching)
    '@/util/electron$': path.resolve(__dirname, 'mocks/electron.ts'),
    '@': rootDir,
  }
}

const config: StorybookConfig = {
  stories: ['../**/*.stories.tsx'],
  addons: [],
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      builder: {
        lazyCompilation: false,
      },
    },
  },
  staticDirs: [
    {from: '../fonts/electron', to: '/fonts/electron'},
    {from: '../images', to: '/images'},
  ],
  typescript: {
    check: false,
    reactDocgen: false,
  },
  webpackFinal: webpackConfig => {
    // Aliases + extensions (.tsx/.ts must be listed so webpack resolves index files and bare paths)
    webpackConfig.resolve = webpackConfig.resolve ?? {}
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias ?? {}),
      ...makeAliases(),
    }
    webpackConfig.resolve.extensions = ['.tsx', '.ts', '.desktop.tsx', '.desktop.ts', '.js', '.jsx', '.json']

    // Storybook 10 does not include a JS/TS transpiler by default — add babel-loader
    // so that TypeScript and JSX in story files and preview config are compiled.
    // We provide explicit presets rather than relying on babel.config.js caller detection
    // (the project config only enables @babel/preset-react for test env, not webpack).
    webpackConfig.module = webpackConfig.module ?? {rules: []}
    webpackConfig.module.rules = webpackConfig.module.rules ?? []
    webpackConfig.module.rules.push({
      test: /\.(tsx?|jsx?)$/,
      exclude: /node_modules/,
      use: [
        {
          loader: require.resolve('babel-loader'),
          options: {
            presets: [
              ['@babel/preset-env', {targets: {browsers: 'last 2 Chrome versions'}}],
              ['@babel/preset-react', {runtime: 'automatic'}],
              '@babel/preset-typescript',
            ],
            // No module-resolver here — webpack handles '@' alias directly so
            // the webpack alias overrides (e.g. @/util/electron → mock) apply correctly.
          },
        },
      ],
    })

    // Fonts as assets (mirrors desktop/webpack.config.mts)
    webpackConfig.module.rules.push({
      test: /\.ttf$/,
      type: 'asset/resource',
    })

    // Null-load native-only files (must run before other loaders)
    webpackConfig.module.rules.unshift({
      test: /\.(native|ios|android)\.(ts|js)x?$/,
      use: ['null-loader'],
    })

    // Platform globals — same as desktop/webpack.config.mts makeDefineValues
    webpackConfig.plugins = webpackConfig.plugins ?? []
    webpackConfig.plugins.push(
      new webpack.DefinePlugin({
        isMobile: JSON.stringify(false),
        isElectron: JSON.stringify(true),
        isAndroid: JSON.stringify(false),
        isIOS: JSON.stringify(false),
        __DEV__: JSON.stringify(true),
        __HOT__: JSON.stringify(false),
        __PROFILE__: JSON.stringify(false),
        __VERSION__: JSON.stringify('storybook'),
        __FILE_SUFFIX__: JSON.stringify(''),
      })
    )

    return webpackConfig
  },
}

export default config
