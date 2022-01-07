// when reanimated is on you can't use the chrome debuger
// comment this out and use the mock if you want to stub out reanimated
import ReAnimated, {Easing as ReAnimatedEasing} from 'react-native-reanimated'
export {ReAnimated, ReAnimatedEasing}
export * from 'react-native-reanimated'
export default ReAnimated
////////////////////////////////////////////////////
// BEGIN MOCK
////////////////////////////////////////////////////
// import {ScrollView, View} from 'react-native'
// const ReAnimated = {
//   Clock: () => ({}),
//   Code: () => null,
//   concat: () => '0deg',
//   Value: () => ({
//     setValue: () => {},
//     getValue: () => 0,
//   }),
//   block: () => 0,
//   event: () => {},
//   createAnimatedComponent: f => f,
//   greaterOrEq: () => {},
//   startClock: () => {},
//   stopClock: () => {},
//   cond: () => {},
//   set: () => {},
//   timing: () => {},
//   defined: () => {},
//   add: () => {},
//   spring: () => {},
//   interpolateNode: () => 0,
//   SpringUtils: {
//     makeDefaultConfig: () => ({}),
//   },
//   Extrapolate: {
//     CLAMP: () => 0,
//   },
//   ScrollView,
//   View,
// }
//
// export const ReAnimatedEasing = () => {}
// export const EasingNode = {
//   inOut: () => 0,
// }
// export default ReAnimated
