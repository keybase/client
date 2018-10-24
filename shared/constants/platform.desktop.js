// @flow
// import path from 'path'
console.log('aaa platform desktop start')
const path = keybase.path
const env = keybase.process.env
const platform = keybase.process.platform

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

// For storyshots, we only want to test macOS
export const fileUIName = isDarwin || __STORYBOOK__ ? 'Finder' : isWindows ? 'Explorer' : 'File Explorer'

const runMode = env['KEYBASE_RUN_MODE'] || 'prod'
const homeEnv = env['HOME'] || ''

if (__DEV__ && !__STORYBOOK__) {
  console.log(`Run mode: ${runMode}`)
}

const socketName = 'keybased.sock'

const getLinuxPaths = () => {
  // If XDG_RUNTIME_DIR is defined use that, else use $HOME/.config.
  const homeConfigDir = path.join(homeEnv, '.config')
  const runtimeDir = env['XDG_RUNTIME_DIR'] || ''
  const cacheDir = runtimeDir || homeConfigDir
  const appName = `keybase${runMode === 'prod' ? '' : `.${runMode}`}`

  if (!runtimeDir && !homeEnv) {
    console.warn(
      "You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path."
    )
  }

  const logDir = `${env['XDG_CACHE_HOME'] || `${homeEnv}/.cache`}/${appName}/`

  return {
    cacheRoot: logDir,
    dataRoot: `${env['XDG_DATA_HOME'] || `${homeEnv}/.local/share`}/${appName}/`,
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    logFileName: `${logDir}Keybase.app.log`,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: path.join(cacheDir, appName, socketName),
  }
}

const getWindowsPaths = () => {
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  let appdata = env['LOCALAPPDATA'] || ''
  // Remove leading drive letter e.g. C:
  if (/^[a-zA-Z]:/.test(appdata)) {
    appdata = appdata.slice(2)
  }
  let dir = `\\\\.\\pipe\\kbservice${appdata}\\${appName}`
  const logDir = `${env['LOCALAPPDATA'] || ''}\\${appName}\\`
  return {
    cacheRoot: `${env['APPDATA'] || ''}\\${appName}\\`,
    dataRoot: `${env['LOCALAPPDATA'] || ''}\\${appName}\\`,
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    logFileName: `${logDir}keybase.app.log`,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: path.join(dir, socketName),
  }
}

const getDarwinPaths = () => {
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  const libraryDir = `${homeEnv}/Library/`
  const logDir = `${libraryDir}Logs/`

  return {
    cacheRoot: `${libraryDir}Caches/${appName}/`,
    dataRoot: `${libraryDir}Application Support/${appName}/`,
    jsonDebugFileName: `${logDir}${appName}.app.debug`,
    logDir,
    logFileName: `${logDir}${appName}.app.log`,
    serverConfigFileName: `${logDir}${appName}.app.serverConfig`,
    socketPath: path.join(`${libraryDir}Group Containers/keybase/Library/Caches/${appName}/`, socketName),
  }
}

const paths =
  (isLinux && getLinuxPaths()) || (isWindows && getWindowsPaths()) || (isDarwin && getDarwinPaths())
if (!paths) {
  throw new Error('Unknown OS')
}

export const {dataRoot, cacheRoot, socketPath, jsonDebugFileName, serverConfigFileName, logFileName} = paths

// Empty string means let the service figure out the right directory.
export const pprofDir = ''
export const version = 'TODO'
export {runMode}
console.log('aaa platform desktop end')
