/* eslint-env jest */

// import * as React from 'react'
// require('../app/preload.native')
// require('immer').enableAllPlugins()

// // fixed in 5.3 storybook
// // eslint-disable-next-line
// jest.mock('global', () => Object.assign(global, {window: {STORYBOOK_HOOKS_CONTEXT: ''}}))

// jest.unmock('constants/platform')
// jest.mock('constants/platform', () => ({
//   fileUIName: 'Finder',
//   isAndroid: false,
//   isDarwin: false,
//   isElectron: false,
//   isIOS: true,
//   isIPhoneX: false,
//   isLargeScreen: false,
//   isLinux: false,
//   isMobile: true,
//   isTablet: false,
//   isWindows: false,
//   logFileName: () => '',
//   pprofDir: () => '',
//   runMode: false,
//   version: '',
//   windowHeight: 0,
// }))

// jest.mock('react-native-gesture-handler', () => {
//   const React = require('react')
//   // eslint-disable-next-line
//   const Mock = React.forwardRef((p, _ref) => p.children ?? null)
//   return {
//     LongPressGestureHandler: Mock,
//     PanGestureHandler: Mock,
//     RectButton: () => null,
//     State: () => null,
//     TapGestureHandler: Mock,
//   }
// })

// jest.mock('react-native-gesture-handler/Swipeable', () => {
//   const React = require('react')
//   // eslint-disable-next-line
//   const Mock = React.forwardRef((p, _ref) => p.children ?? null)
//   return {
//     default: Mock,
//   }
// })
// jest.mock('react-native-safe-area-context', () => ({
//   SafeAreaView: p => p.children ?? null,
//   useSafeArea: () => ({
//     bottom: 0,
//     left: 0,
//     right: 0,
//     top: 0,
//   }),
// }))
// jest.mock('react-native-iphone-x-helper', () => ({
//   getBottomSpace: () => 0,
//   getStatusBarHeight: () => 20,
//   ifIphoneX: (_iphoneXStyle, regularStyle) => regularStyle,
//   isIphoneX: () => false,
// }))
// jest.mock('@react-navigation/core', () => ({
//   withNavigation: C => {
//     return p => {
//       return (
//         <C
//           {...p}
//           navigation={{
//             addListener: jest.fn(),
//             dangerouslyGetParent: jest.fn(),
//             dispatch: jest.fn(),
//             getParam: jest.fn(),
//             goBack: jest.fn(),
//             isFocused: jest.fn(),
//             navigate: jest.fn(),
//             pop: jest.fn(),
//             setParams: jest.fn(),
//             state: jest.fn(),
//           }}
//         />
//       )
//     }
//   },
// }))
// jest.mock('expo-constants', () => ({}))
// jest.mock('expo-image-picker', () => ({
//   MediaTypeOptions: {
//     All: 0,
//     Images: 0,
//     Videos: 0,
//   },
//   launchCameraAsync: () => Promise.resolve(),
//   launchImageLibraryAsync: () => Promise.resolve(),
// }))
// jest.mock('expo-permissions', () => ({}))
// jest.mock('expo-barcode-scanner', () => ({}))
// jest.mock('react-native-hw-keyboard-event', () => ({
//   onHWKeyPressed: jest.fn(),
//   removeOnHWKeyPressed: jest.fn(),
// }))

// jest.mock('react-native-reanimated', () => {
//   const mocks = {
//     Clock: jest.fn(),
//     Code: () => null,
//     Easing: {
//       inOut: jest.fn(),
//     },
//     Extrapolate: {
//       CLAMP: 'clamp',
//     },
//     ScrollView: p => p.children ?? null,
//     SpringUtils: {
//       makeDefaultConfig: () => {},
//     },
//     Value: jest.fn(),
//     View: p => p.children ?? null,
//     add: jest.fn(),
//     block: jest.fn(),
//     call: jest.fn(),
//     clockRunning: jest.fn(),
//     concat: jest.fn(),
//     cond: jest.fn(),
//     createAnimatedComponent: C => C,
//     defined: jest.fn(),
//     eq: jest.fn(),
//     event: () => () => {},
//     greaterOrEq: jest.fn(),
//     interpolate: jest.fn(),
//     not: jest.fn(),
//     set: jest.fn(),
//     spring: jest.fn(),
//     startClock: jest.fn(),
//     stopClock: jest.fn(),
//     timing: jest.fn(),
//   }
//   return {
//     ...mocks,
//     default: mocks,
//   }
// })
