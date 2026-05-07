const reactCompilerPlugin = 'babel-plugin-react-compiler'
const moduleResolverPlugin = ['module-resolver', {alias: {'@': './'}}]

const makeElectronConfig = isTest => ({
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    ...(isTest ? [['@babel/preset-react', {runtime: 'automatic'}], '@babel/preset-flow'] : []),
    '@babel/preset-typescript',
  ],
  plugins: [
    reactCompilerPlugin, // must run first!
  ],
})

const makeReactNativeConfig = () => ({
  plugins: [
    reactCompilerPlugin, // must run first!
    moduleResolverPlugin,
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
  const platform = detectPlatform(apiEnv, callerName)
  const isTest = apiEnv === 'test' || apiEnv === 'test-rn'

  api.cache.using(() => `${apiEnv}:${callerName ?? 'unknown'}:${platform}`)

  // console.error('KB babel.config.js ', {apiEnv, callerName, platform})

  if (platform === 'electron') {
    // console.error('KB babel.config.js for Electron')
    return makeElectronConfig(isTest)
  }
  if (platform === 'react-native') {
    // console.error('KB babel.config.js for ReactNative')
    return makeReactNativeConfig()
  }

  throw new Error(`Unable to determine Babel platform from env/caller: ${apiEnv}/${callerName ?? 'unknown'}`)
}
