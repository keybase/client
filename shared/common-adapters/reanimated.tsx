import {isDebuggingInChrome} from '../constants/platform'
import skipAnimations from './skip-animations'
import {ScrollView, View} from 'react-native'
import type {
  default as ReAnimatedType,
  Easing as EasingType,
  useSharedValue as useSharedValueType,
  useAnimatedStyle as useAnimatedStyleType,
  withTiming as withTimingType,
  EasingNode as EasingNodeType,
} from 'react-native-reanimated'

let ReAnimated: typeof ReAnimatedType
let ReAnimatedEasing: typeof EasingType
let useSharedValue: typeof useSharedValueType
let useAnimatedStyle: typeof useAnimatedStyleType
let withTiming: typeof withTimingType
let EasingNode: typeof EasingNodeType

if (!skipAnimations) {
  const rnr = require('react-native-reanimated')
  ReAnimated = rnr.default
  ReAnimatedEasing = rnr.Easing
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
  class Clock {
    constructor() {}
  }
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
  useAnimatedStyle = (f: () => Object): any => f()
  withTiming = (a: any) => a
  ReAnimatedEasing = ((_: any) => {}) as any
  EasingNode = {
    ease: (_: any) => 0,
    inOut: (_: any) => 0,
  } as any
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
}
export default ReAnimated
