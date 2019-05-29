if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

console.warn('Platform mocking in effect. Acting as darwin')

export const runMode = false
export const isMobile = false
export const isAndroid = false
export const isIOS = false
export const isLargeScreen = false
export const isElectron = true
export const isDarwin = true
export const isWindows = false
export const isLinux = false
export const isIPhoneX = false
export const fileUIName = 'Finder'
export const version = ''
export const logFileName = () => ''
export const pprofDir = () => ''
