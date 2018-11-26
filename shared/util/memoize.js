// @flow
import memoize from 'memoize-one'
import shallowEqual from 'shallowequal'

const memoize1Obj = (f: any) =>
  memoize(
    f,
    // $FlowIssue - the type of memoize1 is wonky
    (a, b) => shallowEqual(a, b)
  )

export {
  memoize1Obj,
  memoize as memoize1,
  memoize as memoize2,
  memoize as memoize3,
  memoize as memoize4,
  memoize as memoize5,
  memoize as memoize6,
}
