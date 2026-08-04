const reactCompilerPlugin = 'babel-plugin-react-compiler'
const moduleResolverPlugin = ['module-resolver', {alias: {'@': './'}}]

// Replaces platform globals (isMobile, isElectron, isAndroid, isIOS) with boolean
// literals at Babel transform time. This lets Metro's constant-folding-plugin DCE
// dead platform branches in production bundles.
const makePlatformPlugin = defines => babel => {
  const {types: t} = babel
  return {
    name: 'inline-platform-globals',
    visitor: {
      Identifier(path) {
        const {name} = path.node
        if (!(name in defines) || !path.isReferencedIdentifier()) return
        if (path.scope.getBinding(name)) return
        path.replaceWith(t.booleanLiteral(defines[name]))
      },
    },
  }
}

// Electron only reaches Babel through jest (BABEL_ENV=test) — the Vite desktop
// build does not load this config. React-native covers Metro builds.
// No platformPlugin here: tests read the platform globals from jest.setup.js at
// runtime (and may flip them per-test); inlining would bake them in at transform time.
const makeElectronConfig = () => ({
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    ['@babel/preset-react', {runtime: 'automatic'}],
    '@babel/preset-typescript',
  ],
  plugins: [
    reactCompilerPlugin, // must run first!
  ],
})

// Worklets Bundle Mode: we pass options to the worklets plugin ourselves, so the
// preset's auto-added (optionless) copy must be disabled via worklets/reanimated: false.
const workletsPlugin = ['react-native-worklets/plugin', {bundleMode: true, strictGlobal: true}]

const makeReactNativeConfig = platformPlugin => ({
  plugins: [
    reactCompilerPlugin, // must run first!
    moduleResolverPlugin,
    platformPlugin,
    workletsPlugin,
  ],
  presets: [
    [
      'babel-preset-expo',
      {
        jsxRuntime: 'automatic',
        reanimated: false,
        unstable_transformImportMeta: true,
        worklets: false,
      },
    ],
  ],
  sourceMaps: true,
})

module.exports = function (api /*: any */) {
  const apiEnv = api.env()
  const metroPlatform = api.caller(c => c?.platform ?? null) // 'ios' | 'android' | null
  const isElectron = apiEnv === 'test'

  api.cache.using(() => `${apiEnv}:${metroPlatform ?? 'none'}`)

  if (isElectron) return makeElectronConfig()

  const platformPlugin = makePlatformPlugin({
    isMobile: !isElectron,
    isElectron,
    isAndroid: metroPlatform === 'android',
    isIOS: metroPlatform === 'ios',
  })

  return makeReactNativeConfig(platformPlugin)
}
