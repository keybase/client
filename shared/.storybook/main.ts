import path from 'path'
import {fileURLToPath} from 'url'
import type {StorybookConfig} from '@storybook/react-vite'
import type {Alias} from 'vite'
import {makeAlias, sharedResolve, emptyFileModulesPlugin} from '../vite.config.mts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Storybook-only mocks (must resolve before makeAlias's '@' -> rootDir entry):
// the real @/util/electron needs electron; safe-navigation calls react-navigation
// useIsFocused() which throws with no navigator.
const storybookAliases: Array<Alias> = [
  {find: /^@\/util\/electron$/, replacement: path.resolve(__dirname, 'mocks/electron.ts')},
  {find: /^@\/util\/safe-navigation$/, replacement: path.resolve(__dirname, 'mocks/safe-navigation.ts')},
]

// Platform globals — same as vite.config.mts makeDefines, pinned for storybook.
const storybookDefines: Record<string, string> = {
  isMobile: JSON.stringify(false),
  isElectron: JSON.stringify(true),
  isAndroid: JSON.stringify(false),
  isIOS: JSON.stringify(false),
  __DEV__: JSON.stringify(true),
  __HOT__: JSON.stringify(false),
  __PROFILE__: JSON.stringify(false),
  __VERSION__: JSON.stringify('storybook'),
  __FILE_SUFFIX__: JSON.stringify(''),
  global: 'globalThis',
}

const config: StorybookConfig = {
  stories: ['../**/*.stories.tsx'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: [
    {from: '../fonts/electron', to: '/fonts/electron'},
    {from: '../images', to: '/images'},
  ],
  typescript: {
    check: false,
    reactDocgen: false,
  },
  viteFinal: config => {
    config.resolve ??= {}
    const existing = config.resolve.alias
    const existingArr: Array<Alias> = Array.isArray(existing)
      ? (existing as Array<Alias>)
      : existing
        ? Object.entries(existing).map(([find, replacement]) => ({find, replacement: replacement as string}))
        : []
    // Our aliases first so they win over any storybook defaults.
    config.resolve.alias = [...storybookAliases, ...makeAlias(), ...existingArr]
    config.resolve.extensions = sharedResolve.extensions
    config.define = {...(config.define ?? {}), ...storybookDefines}
    config.plugins = [...(config.plugins ?? []), emptyFileModulesPlugin(true)]
    return config
  },
}

export default config
