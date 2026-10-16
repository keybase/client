import {Easing} from 'react-native'

// RN's Easing functions are unbound methods, so they're wrapped rather than
// passed as callbacks. Nothing here touches Easing until an animation runs: the
// jest react-native mock has none.

export const linearEasing = (t: number) => Easing.linear(t)

let easeInOutCurve: ((t: number) => number) | undefined
// Built once, on the first frame that needs it, not per frame.
export const easeInOutEasing = (t: number) => {
  easeInOutCurve ??= Easing.inOut((x: number) => Easing.ease(x))
  return easeInOutCurve(t)
}
