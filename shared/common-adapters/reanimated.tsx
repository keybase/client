import {isDebuggingInChrome, isMobile} from '../constants/platform'
import skipAnimations from './skip-animations'
import type {
  default as ReAnimatedType,
  useSharedValue as useSharedValueType,
  useAnimatedStyle as useAnimatedStyleType,
  withTiming as withTimingType,
  withDelay as withDelayType,
  withRepeat as withRepeatType,
  interpolate as interpolateType,
  useAnimatedScrollHandler as useAnimatedScrollHandlerType,
  Extrapolation as ExtrapolationType,
  withSpring as withSpringType,
} from 'react-native-reanimated'

let useSharedValue: typeof useSharedValueType
let withRepeat: typeof withRepeatType
let useAnimatedStyle: typeof useAnimatedStyleType
let withTiming: typeof withTimingType
let withDelay: typeof withDelayType
let useAnimatedScrollHandler: typeof useAnimatedScrollHandlerType
let createAnimatedComponent: typeof ReAnimatedType['createAnimatedComponent']
let Animated: typeof ReAnimatedType
let interpolate: typeof interpolateType
let Extrapolation: typeof ExtrapolationType
let withSpring: typeof withSpringType

if (isMobile && !skipAnimations) {
  const rnr = require('react-native-reanimated')
  Animated = rnr.default
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
  if (isDebuggingInChrome) {
    console.log('DEBUG: Real ReAnimated enabled, yet in chrome. Might not work!')
  }
} else {
  if (isMobile) {
    console.log('\n\n\nDEBUG: mock ReAnimated enabled')
  }
  Animated = {View: ({children}) => children} as any
  createAnimatedComponent = (f: any) => f
  useSharedValue = (a: any) => ({value: a})
  withRepeat = (a: any) => a
  useAnimatedStyle = (f: () => Object): any => f()
  withTiming = (a: any) => a
  withDelay = (a: any) => a
  useAnimatedScrollHandler = () => () => {}
  interpolate = (a: any) => a

  enum _Extrapolation {
    IDENTITY = 'identity',
    CLAMP = 'clamp',
    EXTEND = 'extend',
  }

  // @ts-ignore
  Extrapolation = _Extrapolation
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
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  withSpring,
  Extrapolation,
}
export default Animated
export type {SharedValue} from 'react-native-reanimated'
