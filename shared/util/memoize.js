// @flow
import memoize from 'memoize-one'
import shallowEqual from 'shallowequal'

const memoize1Shallow = (f: any) => memoize(f, (a, b) => shallowEqual(a, b))

type EQ = ?(a: any, b: any) => boolean
const _memoize = (f: any, eq1: EQ, eq2: EQ, eq3: EQ, eq4: EQ) =>
  memoize(f, (a, b, idx) => {
    switch (idx) {
      case 0:
        return eq1 ? eq1(a, b) : a === b
      case 1:
        return eq2 ? eq2(a, b) : a === b
      case 2:
        return eq3 ? eq3(a, b) : a === b
      case 3:
        return eq4 ? eq4(a, b) : a === b
      default:
        return a === b
    }
  })

export {
  memoize1Shallow,
  _memoize as memoize1,
  _memoize as memoize2,
  _memoize as memoize3,
  _memoize as memoize4,
  _memoize as memoize5,
  _memoize as memoize6,
}
