/* eslint-env jest */
require('../app/preload.native')
require('immer').enableAllPlugins()
// fixed in 5.3 storybook
jest.mock('global', () => Object.assign(global, {window: {STORYBOOK_HOOKS_CONTEXT: ''}}))

jest.unmock('constants/platform')
jest.mock('constants/platform', () => ({
  fileUIName: 'Finder',
  isAndroid: false,
  isDarwin: false,
  isElectron: false,
  isIOS: true,
  isIPhoneX: false,
  isLargeScreen: false,
  isLinux: false,
  isMobile: false,
  isTablet: false,
  isWindows: false,
  logFileName: () => '',
  pprofDir: () => '',
  runMode: false,
  version: '',
  windowHeight: 0,
}))
jest.mock('rn-fetch-blob', () => ({
  fs: {
    dirs: {
      CacheDir: '',
    },
  },
}))
jest.mock('react-native-iphone-x-helper', () => ({
  getBottomSpace: () => 0,
  getStatusBarHeight: () => 20,
  ifIphoneX: (iphoneXStyle, regularStyle) => regularStyle,
  isIphoneX: () => false,
}))
jest.mock('expo-constants', () => ({}))
jest.mock('expo-image-picker', () => ({}))
jest.mock('expo-permissions', () => ({}))
jest.mock('expo-barcode-scanner', () => ({}))
jest.mock('react-native-reanimated', () => ({
  Value: jest.fn(),
  block: jest.fn(),
  call: jest.fn(),
  clockRunning: jest.fn(),
  cond: jest.fn(),
  createAnimatedComponent: jest.fn(),
  default: {
    Value: jest.fn(),
    block: jest.fn(),
    call: jest.fn(),
    clockRunning: jest.fn(),
    cond: jest.fn(),
    createAnimatedComponent: jest.fn(),
    easing: jest.fn(),
    eq: jest.fn(),
    not: jest.fn(),
    set: jest.fn(),
    startClock: jest.fn(),
    stopClock: jest.fn(),
    timing: jest.fn(),
  },
  easing: jest.fn(),
  eq: jest.fn(),
  not: jest.fn(),
  set: jest.fn(),
  startClock: jest.fn(),
  stopClock: jest.fn(),
  timing: jest.fn(),
}))
