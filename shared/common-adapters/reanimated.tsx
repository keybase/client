import {isDebuggingInChrome} from '../constants/platform'
// when reanimated is on you can't use the chrome debugger
// comment this out and use the mock if you want to stub out reanimated
import ReAnimated, {Easing as ReAnimatedEasing} from 'react-native-reanimated'
export {ReAnimated, ReAnimatedEasing}
export * from 'react-native-reanimated'
export default ReAnimated
if (isDebuggingInChrome) {
  console.log('DEBUG: Real ReAnimated enabled, yet in chrome. Might not work!')
}
////////////////////////////////////////////////////
// BEGIN MOCK
////////////////////////////////////////////////////

// console.log('\n\n\nDEBUG: mock ReAnimated enabled')
// import {ScrollView, View} from 'react-native'
// class Value {
//   _v: any
//   constructor(v: any) {
//     this._v = v
//   }
//   setValue(v: any) {
//     this._v = v
//   }
//   getValue() {
//     return this._v
//   }
// }
// class Clock {
//   constructor() {}
// }
// const ReAnimated = {
//   Clock: Clock,
//   Code: (_: any) => null,
//   Extrapolate: {CLAMP: (_: any) => 0},
//   ScrollView,
//   SpringUtils: {makeDefaultConfig: (_: any) => ({})},
//   Value,
//   View,
//   add: (_: any, __: any) => {},
//   block: (_: any) => 0,
//   concat: (_: any) => '0deg',
//   cond: (_: any, __: any) => {},
//   createAnimatedComponent: (f: any) => f,
//   defined: (_: any) => {},
//   event: (_: any) => {},
//   greaterOrEq: (_: any) => {},
//   interpolateNode: (_: any, __: any) => 0,
//   set: (_: any, __: any) => {},
//   spring: (_: any) => {},
//   startClock: (_: any) => {},
//   stopClock: (_: any) => {},
//   timing: (_: any, __: any, ___: any) => {},
// }

// export const ReAnimatedEasing = (_: any) => {}
// export const EasingNode = {
//   ease: (_: any) => 0,
//   inOut: (_: any) => 0,
// }
// export default ReAnimated
// if (!isDebuggingInChrome) {
//   console.log('DEBUG: Mock ReAnimated enabled, yet not in chrome. Some animations will be missing')
// }
