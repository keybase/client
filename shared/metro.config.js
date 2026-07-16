const {getDefaultConfig} = require('expo/metro-config')
const {getBundleModeMetroConfig} = require('react-native-worklets/bundleMode')
const path = require('path')
const ignoredModules = require('./ignored-modules')
const desktopOnlyModules = require('./desktop-only-modules')

const root = path.resolve(__dirname, '.')
const rootRe = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nullModule = path.join(root, 'null-module.js')

const config = getDefaultConfig(__dirname)

const desktopOnlySet = new Set(desktopOnlyModules)

config.resolver = {
  ...config.resolver,
  extraNodeModules: ignoredModules.reduce((acc, name) => {
    acc[name] = nullModule
    return acc
  }, {}),
  resolveRequest: (context, moduleName, platform) => {
    // Null out desktop-only packages, explicit .desktop platform imports, and CSS (desktop-only)
    if (desktopOnlySet.has(moduleName) || moduleName.endsWith('.desktop') || moduleName.endsWith('.css')) {
      return {type: 'sourceFile', filePath: nullModule}
    }
    return context.resolveRequest(context, moduleName, platform)
  },
}

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  new RegExp(`^${rootRe}/tests/results/`),
  new RegExp(`^${rootRe}/\\.maestro/`),
  new RegExp(`^${rootRe}/desktop/`),
  new RegExp(`^${rootRe}/ios/build/`),
  new RegExp(`^${rootRe}/ios/Pods/`),
  new RegExp(`^${rootRe}/ios/dist/`),
  new RegExp(`^${rootRe}/android/app/build/`),
  new RegExp(`^${rootRe}/android/build/`),
  new RegExp(`^${rootRe}/android/\\.gradle/`),
  new RegExp(`^${rootRe}/docs/`),
  new RegExp(`^${rootRe}/coverage-ts/`),
  new RegExp(`^${rootRe}/patches/`),
  new RegExp(`^${rootRe}/scripts/`),
  new RegExp(`^${rootRe}/tools/`),
]

// Worklets Bundle Mode needs every runtime to share one complete bundle, but
// RCTBundleURLProvider hardcodes lazy=true for dev requests and the worklet
// runtimes never receive lazy chunk deltas. Force non-lazy serving here.
const prevRewriteRequestUrl = config.server.rewriteRequestUrl
config.server = {
  ...config.server,
  rewriteRequestUrl: url => {
    const rewritten = prevRewriteRequestUrl ? prevRewriteRequestUrl(url) : url
    return rewritten.replace(/([?&])lazy=true/, '$1lazy=false')
  },
}

// Bundle Mode: chains our resolveRequest behind the worklets shims, pre-loads
// worklet entry points, and pins module ids so all runtimes share the bundle.
module.exports = getBundleModeMetroConfig(config)
