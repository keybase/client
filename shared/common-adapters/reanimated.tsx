// when reanimated is on you can't use the chrome debuger
// comment this out and use the mock if you want to stub out reanimated
// import ReAnimated, {Easing as ReAnimatedEasing} from 'react-native-reanimated'
// export {ReAnimated, ReAnimatedEasing}
// export * from 'react-native-reanimated'
// export default ReAnimated
////////////////////////////////////////////////////
// BEGIN MOCK
////////////////////////////////////////////////////

console.log('\n\n\nDEBUG: mock ReAnimated enabled')
import {ScrollView, View} from 'react-native'
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
const ReAnimated = {
  Clock: Clock,
  Code: (_: any) => null,
  concat: (_: any) => '0deg',
  Value,
  block: (_: any) => 0,
  event: (_: any) => {},
  createAnimatedComponent: f => f,
  greaterOrEq: (_: any) => {},
  startClock: (_: any) => {},
  stopClock: (_: any) => {},
  cond: (_: any, __: any) => {},
  set: (_: any, __: any) => {},
  timing: (_: any, __: any, ___: any) => {},
  defined: (_: any) => {},
  add: (_: any, __: any) => {},
  spring: (_: any) => {},
  interpolateNode: (_: any, __: any) => 0,
  SpringUtils: {
    makeDefaultConfig: (_: any) => ({}),
  },
  Extrapolate: {
    CLAMP: (_: any) => 0,
  },
  ScrollView,
  View,
}

export const ReAnimatedEasing = (_: any) => {}
export const EasingNode = {
  inOut: (_: any) => 0,
  ease: (_: any) => 0,
}
export default ReAnimated
