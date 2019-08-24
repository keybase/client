import memoize from 'memoize-one'
import shallowEqual from 'shallowequal'

const memoizeShallow = (f: any) => memoize(f, ([a], [b]) => shallowEqual(a, b))

export {memoizeShallow, memoize}
