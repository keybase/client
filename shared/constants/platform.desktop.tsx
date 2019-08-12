import platformPaths from './platform-paths.desktop'

const platform = KB.process.platform
const env = KB.process.env
const pathJoin = KB.path.join

export const isMobile = false
export const isAndroid = false
export const isIOS = false
export const isLargeScreen = true
export const isIPhoneX = false
export const isElectron = true
export const isDarwin = platform === 'darwin'
export const isWindows = platform === 'win32'
export const isLinux = platform === 'linux'
export const isAndroidNewerThanN = false
export const isMac = isDarwin && !isIOS
export const shortcutSymbol = isDarwin ? '⌘' : 'Ctrl-'

export const defaultUseNativeFrame = isDarwin || isLinux

// For storyshots, we only want to test macOS
export const fileUIName = isDarwin || __STORYBOOK__ ? 'Finder' : isWindows ? 'Explorer' : 'File Explorer'

export const runMode = env['KEYBASE_RUN_MODE'] || 'prod'

if (__DEV__ && !__STORYBOOK__) {
  console.log(`Run mode: ${runMode}`)
}

export const {
  dataRoot,
  cacheRoot,
  socketPath,
  jsonDebugFileName,
  serverConfigFileName,
  logFileName,
} = platformPaths(platform, runMode, env, pathJoin)

// Empty string means let the service figure out the right directory.
export const pprofDir = ''
export const version = 'TODO'
