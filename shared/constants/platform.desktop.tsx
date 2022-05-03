export const androidIsTestDevice = false
export const isMobile = false
export const isPhone = false
export const isAndroid = false
export const isIOS = false
export const isLargeScreen = true
export const isIPhoneX = false
export const isTablet = false
export const windowHeight = 0 // not implemented on desktop
export const isDebuggingInChrome = true
export const isElectron = true
export const isAndroidNewerThanN = false
export const shortcutSymbol = KB.constants.isDarwin ? '⌘' : 'Ctrl-'
export const realDeviceName = ''

export const defaultUseNativeFrame = KB.constants.isDarwin || KB.constants.isLinux

// For storyshots, we only want to test macOS
export const fileUIName =
  KB.constants.isDarwin || __STORYBOOK__ ? 'Finder' : KB.constants.isWindows ? 'Explorer' : 'File Explorer'

// const runMode = KB.process.env['KEYBASE_RUN_MODE'] || 'prod'
// const homeEnv = KB.process.env['HOME'] || ''

// if (__DEV__ && !__STORYBOOK__) {
//   console.log(`Run mode: ${runMode}`)
// }

// const paths =
//   (isLinux && getLinuxPaths()) || (isWindows && getWindowsPaths()) || (isDarwin && getDarwinPaths())
// if (!paths) {
//   throw new Error('Unknown OS')
// }

// export const {dataRoot, cacheRoot, socketPath, jsonDebugFileName, serverConfigFileName, guiConfigFilename} =
//   paths

export const {
  downloadFolder,
  dataRoot,
  cacheRoot,
  socketPath,
  jsonDebugFileName,
  serverConfigFileName,
  guiConfigFilename,
  isDarwin,
  isWindows,
  isLinux,
  isMac,
  runMode,
  uses24HourClock,
} = KB.constants

// export const downloadFolder = __STORYBOOK__
//   ? ''
//   : KB.process.env.XDG_DOWNLOAD_DIR || KB.path.join(KB.os.homedir, 'Downloads')

// Empty string means let the service figure out the right directory.
export const pprofDir = ''
export const version = 'TODO'
// export {runMode}

// const getTimeLocale = () => {
//   if (!isLinux) {
//     return Intl.DateTimeFormat().resolvedOptions().locale
//   }
//   const locale = process.env.LC_ALL || process.env.LC_TIME || process.env.LANG
//   if (locale) {
//     return locale.slice(0, 2)
//   }
//   return []
// }
// const uses24HourClockF = () => {
//   try {
//     return new Date('1999 Jan 1 20:00').toLocaleString(getTimeLocale()).includes(' 20:')
//   } catch {
//     // unknown locale
//     return false
//   }
// }
// export const uses24HourClock = uses24HourClockF()
