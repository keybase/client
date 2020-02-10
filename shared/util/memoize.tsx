import memoize from 'memoize-one'
import shallowEqual from 'shallowequal'
import {useMemo, useCallback} from 'use-memo-one'

const memoizeShallow = (f: any) => memoize(f, ([a], [b]) => shallowEqual(a, b))

export {memoizeShallow, memoize}
export {useMemo, useCallback}
