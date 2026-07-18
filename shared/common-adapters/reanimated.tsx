import {isDebuggingInChrome} from '@/constants/platform'
import skipAnimations from './skip-animations'
import * as ReanimatedRT from 'react-native-reanimated'
import type * as R from 'react-native-reanimated'

let useSharedValue: typeof R.useSharedValue
let withRepeat: typeof R.withRepeat
let useAnimatedStyle: <T extends () => Record<string, unknown>>(arg: T) => ReturnType<T>
let withTiming: typeof R.withTiming
let withDelay: typeof R.withDelay
let useAnimatedScrollHandler: typeof R.useAnimatedScrollHandler
// reanimated only deprecates manual wrapping of built-ins (Animated.FlatList etc); it's still the
// only API for animating custom components like Kb.Box2
// eslint-disable-next-line @typescript-eslint/no-deprecated
let createAnimatedComponent: typeof R.default.createAnimatedComponent
let Animated: typeof R.default
let interpolate: typeof R.interpolate
let Extrapolation: typeof R.Extrapolation
let withSpring: typeof R.withSpring
let useReducedMotion: typeof R.useReducedMotion

if (isMobile && !skipAnimations) {
  const rnr = ReanimatedRT as typeof R
  Animated = rnr.default
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  createAnimatedComponent = rnr.default.createAnimatedComponent
  useAnimatedStyle = rnr.useAnimatedStyle as typeof useAnimatedStyle
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
  Animated = {View: ({children}: {children: unknown}) => children} as unknown as typeof Animated
  createAnimatedComponent = ((f: unknown) => f) as typeof createAnimatedComponent
  useSharedValue = function <Value>(a: Value, _oneWayReadsOnly?: boolean) {
    return {
      addListener: () => {},
      get: () => a,
      modify: () => {},
      removeListener: () => {},
      set: () => {},
      value: a,
    }
  } as typeof useSharedValue
  withRepeat = ((a: unknown) => a) as typeof withRepeat
  useAnimatedStyle = ((f: () => object): unknown => f()) as typeof useAnimatedStyle
  withTiming = ((a: unknown) => a) as typeof withTiming
  withDelay = ((a: unknown) => a) as typeof withDelay
  useAnimatedScrollHandler = () => () => {}
  interpolate = ((a: unknown) => a) as typeof interpolate
  useReducedMotion = () => false

  enum _Extrapolation {
    IDENTITY = 'identity',
    CLAMP = 'clamp',
    EXTEND = 'extend',
  }
  Extrapolation = _Extrapolation as unknown as typeof Extrapolation
  withSpring = ((a: unknown) => a) as typeof withSpring
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
