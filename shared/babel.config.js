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

const makeElectronConfig = (isTest, platformPlugin) => ({
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    ...(isTest ? [['@babel/preset-react', {runtime: 'automatic'}], '@babel/preset-flow'] : []),
    '@babel/preset-typescript',
  ],
  plugins: [
    reactCompilerPlugin, // must run first!
    platformPlugin,
  ],
})

const makeReactNativeConfig = platformPlugin => ({
  plugins: [
    reactCompilerPlugin, // must run first!
    moduleResolverPlugin,
    platformPlugin,
  ],
  presets: [['babel-preset-expo', {unstable_transformImportMeta: true, jsxRuntime: 'automatic'}]],
  sourceMaps: true,
})

const detectPlatform = (apiEnv, callerName) => {
  if (apiEnv === 'test') {
    return 'electron'
  }
  if (apiEnv === 'test-rn') {
    return 'react-native'
  }
  return !callerName || callerName === 'metro' ? 'react-native' : 'electron'
}

module.exports = function (api /*: any */) {
  const apiEnv = api.env()
  const callerName = api.caller(c => c?.name ?? null)
  const metroPlatform = api.caller(c => c?.platform ?? null) // 'ios' | 'android' | null
  const platform = detectPlatform(apiEnv, callerName)
  const isTest = apiEnv === 'test' || apiEnv === 'test-rn'

  api.cache.using(() => `${apiEnv}:${callerName ?? 'unknown'}:${platform}:${metroPlatform ?? 'none'}`)

  const isRN = platform === 'react-native'
  const platformPlugin = makePlatformPlugin({
    isMobile: isRN,
    isElectron: !isRN,
    isAndroid: metroPlatform === 'android',
    isIOS: metroPlatform === 'ios',
  })

  // console.error('KB babel.config.js ', {apiEnv, callerName, platform, metroPlatform})

  if (platform === 'electron') {
    // console.error('KB babel.config.js for Electron')
    return makeElectronConfig(isTest, platformPlugin)
  }
  if (platform === 'react-native') {
    // console.error('KB babel.config.js for ReactNative')
    return makeReactNativeConfig(platformPlugin)
  }

  throw new Error(`Unable to determine Babel platform from env/caller: ${apiEnv}/${callerName ?? 'unknown'}`)
}
