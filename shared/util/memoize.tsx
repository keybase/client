import memoize from 'memoize-one'
import shallowEqual from 'shallowequal'
import {useMemoOne, useCallbackOne} from 'use-memo-one'

const memoizeShallow = (f: any) => memoize(f, ([a], [b]) => shallowEqual(a, b))

export {memoizeShallow, memoize}

export const useMemo = useMemoOne
export const useCallback = useCallbackOne
