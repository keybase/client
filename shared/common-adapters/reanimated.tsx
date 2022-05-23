import {isDebuggingInChrome} from '../constants/platform'
import skipAnimations from './skip-animations'
import {ScrollView, View} from 'react-native'
import type {
  default as ReAnimatedType,
  Easing as EasingType,
  useSharedValue as useSharedValueType,
  useAnimatedStyle as useAnimatedStyleType,
  withTiming as withTimingType,
  withDelay as withDelayType,
  withRepeat as withRepeatType,
  EasingNode as EasingNodeType,
  useAnimatedScrollHandler as useAnimatedScrollHandlerType,
} from 'react-native-reanimated'

let ReAnimated: typeof ReAnimatedType
let ReAnimatedEasing: typeof EasingType
let useSharedValue: typeof useSharedValueType
let withRepeat: typeof withRepeatType
let useAnimatedStyle: typeof useAnimatedStyleType
let withTiming: typeof withTimingType
let withDelay: typeof withDelayType
let EasingNode: typeof EasingNodeType
let useAnimatedScrollHandler: typeof useAnimatedScrollHandlerType

if (!skipAnimations) {
  const rnr = require('react-native-reanimated')
  ReAnimated = rnr.default
  ReAnimatedEasing = rnr.Easing
  EasingNode = rnr.EasingNode
  useAnimatedStyle = rnr.useAnimatedStyle
  useSharedValue = rnr.useSharedValue
  withRepeat = rnr.withRepeat
  withTiming = rnr.withTiming
  withDelay = rnr.withDelay
  useAnimatedScrollHandler = rnr.useAnimatedScrollHandler
  if (isDebuggingInChrome) {
    console.log('DEBUG: Real ReAnimated enabled, yet in chrome. Might not work!')
  }
} else {
  console.log('\n\n\nDEBUG: mock ReAnimated enabled')
  class Value {
    _v: any
    constructor(v: any) {
      this._v = v
    }
    setValue(v: any) {
      this._v = v
    }
    getValue() {
      return this._v
    }
  }
  // eslint-disable-next-line
  class Clock {}
  ReAnimated = {
    Clock: Clock,
    Code: (_: any) => null,
    Extrapolate: {CLAMP: (_: any) => 0},
    ScrollView,
    SpringUtils: {makeDefaultConfig: (_: any) => ({})},
    Value,
    View,
    add: (_: any, __: any) => {},
    block: (_: any) => 0,
    concat: (_: any) => '0deg',
    cond: (_: any, __: any) => {},
    createAnimatedComponent: (f: any) => f,
    defined: (_: any) => {},
    event: (_: any) => {},
    greaterOrEq: (_: any) => {},
    interpolateNode: (_: any, __: any) => 0,
    set: (_: any, __: any) => {},
    spring: (_: any) => {},
    startClock: (_: any) => {},
    stopClock: (_: any) => {},
    timing: (_: any, __: any, ___: any) => {},
  } as any
  useSharedValue = (a: any) => ({value: a})
  withRepeat = (a: any) => a
  useAnimatedStyle = (f: () => Object): any => f()
  withTiming = (a: any) => a
  withDelay = (a: any) => a
  ReAnimatedEasing = ((_: any) => {}) as any
  EasingNode = {
    ease: (_: any) => 0,
    inOut: (_: any) => 0,
  } as any
  useAnimatedScrollHandler = () => () => {}
  if (!isDebuggingInChrome) {
    console.log('DEBUG: Mock ReAnimated enabled, yet not in chrome. Some animations will be missing')
  }
}
export {
  EasingNode,
  ReAnimated,
  ReAnimatedEasing,
  skipAnimations,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  withRepeat,
  useAnimatedScrollHandler,
}
export default ReAnimated
