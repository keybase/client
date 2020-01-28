const {path, process} = KB
const {platform, env} = process
const {join} = path
export const isTestDevice = false
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

const runMode = env['KEYBASE_RUN_MODE'] || 'prod'
const homeEnv = env['HOME'] || ''

if (__DEV__ && !__STORYBOOK__) {
  console.log(`Run mode: ${runMode}`)
}

const socketName = 'keybased.sock'

const getLinuxPaths = () => {
  const useXDG = (runMode !== 'devel' || env['KEYBASE_DEVEL_USE_XDG']) && !env['KEYBASE_XDG_OVERRIDE']

  // If XDG_RUNTIME_DIR is defined use that, else use $HOME/.config.
  const homeConfigDir = (useXDG && env['XDG_CONFIG_HOME']) || join(homeEnv, '.config')
  const runtimeDir = (useXDG && env['XDG_RUNTIME_DIR']) || ''
  const socketDir = (useXDG && runtimeDir) || homeConfigDir

  const appName = `keybase${runMode === 'prod' ? '' : `.${runMode}`}`

  if (!runtimeDir && !homeEnv) {
    console.warn(
      "You don't have $HOME or $XDG_RUNTIME_DIR defined, so we can't find the Keybase service path."
    )
  }

  const logDir = `${(useXDG && env['XDG_CACHE_HOME']) || `${homeEnv}/.cache`}/${appName}/`

  return {
    cacheRoot: logDir,
    dataRoot: `${(useXDG && env['XDG_DATA_HOME']) || `${homeEnv}/.local/share`}/${appName}/`,
    guiConfigFilename: `${homeConfigDir}/${appName}/gui_config.json`,
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: join(socketDir, appName, socketName),
  }
}

const getWindowsPaths = () => {
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  let appdata = env['LOCALAPPDATA'] || ''
  // Remove leading drive letter e.g. C:
  if (/^[a-zA-Z]:/.test(appdata)) {
    appdata = appdata.slice(2)
  }
  const dir = `\\\\.\\pipe\\kbservice${appdata}\\${appName}`
  const logDir = `${env['LOCALAPPDATA'] || ''}\\${appName}\\`
  return {
    cacheRoot: `${env['APPDATA'] || ''}\\${appName}\\`,
    dataRoot: `${env['LOCALAPPDATA'] || ''}\\${appName}\\`,
    guiConfigFilename: `${env['LOCALAPPDATA'] || ''}\\${appName}\\gui_config.json`,
    jsonDebugFileName: `${logDir}keybase.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}keybase.app.serverConfig`,
    socketPath: join(dir, socketName),
  }
}

const getDarwinPaths = () => {
  const appName = `Keybase${runMode === 'prod' ? '' : runMode[0].toUpperCase() + runMode.slice(1)}`
  const libraryDir = `${homeEnv}/Library/`
  const logDir = `${libraryDir}Logs/`

  return {
    cacheRoot: `${libraryDir}Caches/${appName}/`,
    dataRoot: `${libraryDir}Application Support/${appName}/`,
    guiConfigFilename: `${libraryDir}Application Support/${appName}/gui_config.json`,
    jsonDebugFileName: `${logDir}${appName}.app.debug`,
    logDir,
    serverConfigFileName: `${logDir}${appName}.app.serverConfig`,
    socketPath: join(`${libraryDir}Group Containers/keybase/Library/Caches/${appName}/`, socketName),
  }
}

const paths =
  (isLinux && getLinuxPaths()) || (isWindows && getWindowsPaths()) || (isDarwin && getDarwinPaths())
if (!paths) {
  throw new Error('Unknown OS')
}

export const {
  dataRoot,
  cacheRoot,
  socketPath,
  jsonDebugFileName,
  serverConfigFileName,
  guiConfigFilename,
} = paths

// Empty string means let the service figure out the right directory.
export const pprofDir = ''
export const version = 'TODO'
export {runMode}

// Noop – Just for Android
export const appColorSchemeChanged = () => {}

export const isRemoteDebuggerAttached = false
