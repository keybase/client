// @flow
import memoize from 'memoize-one'
import shallowEqual from 'shallowequal'

const memoize1Shallow = (f: any) => memoize(f, (a, b) => shallowEqual(a, b))

export {
  memoize1Shallow,
  memoize as memoize1,
  memoize as memoize2,
  memoize as memoize3,
  memoize as memoize4,
  memoize as memoize5,
  memoize as memoize6,
}
