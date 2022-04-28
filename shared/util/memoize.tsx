import memoizeOne from 'memoize-one'
import shallowEqual from 'shallowequal'
import {useMemoOne, useCallbackOne} from 'use-memo-one'

export const useMemo = useMemoOne
export const useCallback = useCallbackOne
const memoizeShallow = (f: any) => memoize(f, ([a], [b]) => shallowEqual(a, b))
const memoize = memoizeOne
export {memoizeShallow, memoize}

// BEGIN debugging memo
// import deepEqual from 'lodash/isEqual'
// const safeIsNaN =
//   Number.isNaN ||
//   function ponyfill(value) {
//     return typeof value === 'number' && value !== value
//   }
//
// function isEqual(first, second) {
//   if (first === second) {
//     return true
//   }
//   if (safeIsNaN(first) && safeIsNaN(second)) {
//     return true
//   }
//   return false
// }
// function areInputsEqual(newInputs, lastInputs) {
//   if (newInputs.length !== lastInputs.length) {
//     return false
//   }
//   for (var i = 0; i < newInputs.length; i++) {
//     if (!isEqual(newInputs[i], lastInputs[i])) {
//       return false
//     }
//   }
//   return true
// }
//
// const debugMemoizeOne = (f: any) => {
//   return memoizeOne(f, (a, b) => {
//     const defEq = areInputsEqual(a, b)
//     if (!defEq && deepEqual(a, b)) {
//       console.log('DEBUG memoize fail on similar objects', a, b, 'orig: ', f)
//     }
//     return defEq
//   })
// }
// const memoize = __DEV__ ? debugMemoizeOne : memoizeOne
// if (__DEV__) {
//   console.log('\n\n\nDEBUG: debugMemoizeOne enabled')
// }
