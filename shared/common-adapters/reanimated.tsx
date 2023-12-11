import {isDebuggingInChrome, isMobile} from '@/constants/platform'
import skipAnimations from './skip-animations'
import type * as R from 'react-native-reanimated'

let useSharedValue: typeof R.useSharedValue
let withRepeat: typeof R.withRepeat
let useAnimatedStyle: typeof R.useAnimatedStyle
let withTiming: typeof R.withTiming
let withDelay: typeof R.withDelay
let useAnimatedScrollHandler: typeof R.useAnimatedScrollHandler
// eslint-disable-next-line
let createAnimatedComponent: typeof R.default.createAnimatedComponent
let Animated: typeof R.default
let interpolate: typeof R.interpolate
let Extrapolation: typeof R.Extrapolation
let withSpring: typeof R.withSpring
let useReducedMotion: typeof R.useReducedMotion

if (isMobile && !skipAnimations) {
  const rnr = require('react-native-reanimated') as typeof R
  Animated = rnr.default
  // eslint-disable-next-line
  createAnimatedComponent = rnr.default.createAnimatedComponent
  useAnimatedStyle = rnr.useAnimatedStyle
  useSharedValue = rnr.useSharedValue
  withRepeat = rnr.withRepeat
  withTiming = rnr.withTiming
  withDelay = rnr.withDelay
  interpolate = rnr.interpolate
  useAnimatedScrollHandler = rnr.useAnimatedScrollHandler
  Extrapolation = rnr.Extrapolation
  withSpring = rnr.withSpring
  useReducedMotion = rnr.useReducedMotion
  if (isDebuggingInChrome) {
    console.log('DEBUG: Real ReAnimated enabled, yet in chrome. Might not work!')
  }
} else {
  if (isMobile) {
    console.log('\n\n\nDEBUG: mock ReAnimated enabled')
  }
  Animated = {View: ({children}: {children: unknown}) => children} as any as typeof Animated
  createAnimatedComponent = (f: any) => f
  useSharedValue = (a: any, _oneWayReadsOnly?: boolean) => ({
    addListener: () => {},
    modify: () => {},
    removeListener: () => {},
    value: a,
  })
  withRepeat = (a: any) => a
  useAnimatedStyle = (f: () => Object): any => f()
  withTiming = (a: any) => a
  withDelay = (a: any) => a
  useAnimatedScrollHandler = () => () => {}
  interpolate = (a: any) => a
  useReducedMotion = () => false

  enum _Extrapolation {
    IDENTITY = 'identity',
    CLAMP = 'clamp',
    EXTEND = 'extend',
  }
  Extrapolation = _Extrapolation as unknown as typeof Extrapolation
  withSpring = (a: any) => a
  if (!isDebuggingInChrome) {
    console.log('DEBUG: Mock ReAnimated enabled, yet not in chrome. Some animations will be missing')
  }
}
export {
  createAnimatedComponent,
  interpolate,
  skipAnimations,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  withSpring,
  Extrapolation,
}
export default Animated
export type {SharedValue} from 'react-native-reanimated'
