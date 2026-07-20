import * as React from 'react'
import * as C from '@/constants'
import type {RPCError} from './errors'

type Options<RESULT, DATA> = {
  /** skips the mount/focus/key auto-load when false, checked when the trigger fires. reload() ignores this */
  enabled?: boolean
  /**
   * correlate results with the param they were requested for. data/error only
   * surface while the key still matches, and the load auto-refires when the
   * key changes (unless when is 'manual'). Don't combine with when: 'focus'
   */
  key?: string
  /** turn the raw rpc result into the data you want to keep */
  map: (result: RESULT) => DATA
  onError?: (error: RPCError) => void
  /** called after a successful load, with the mapped data */
  onResult?: (data: DATA) => void
  /** when to load: on mount (default), on every screen focus, or only via reload(). Fixed at mount */
  when?: 'mount' | 'focus' | 'manual'
}

/**
 * Load data via an rpc and keep it in local state. Wraps the common
 * useRPC + useState + load-on-mount/focus dance. Like useRPC this skips the
 * state layer entirely; pass a waitingKey inside `args` if you want spinners
 * driven by the waiting store.
 * @returns data: mapped result of the last successful load (for the current key, if keyed)
 * @returns error: error from the last load, cleared on the next success
 * @returns loaded: true once a load attempt finished (success or error; for the current key, if keyed)
 * @returns loading: enabled and no finished attempt yet, spinner-friendly
 * @returns loadCount: number of successful loads, useful as a refresh token
 * @returns reload: kick off a load manually
 * @returns setData: overwrite data locally, for optimistic updates; the next load result wins
 */
export function useRPCLoad<F extends (...rest: any[]) => Promise<any>, DATA>(
  call: F,
  args: Parameters<F>,
  opts: Options<Awaited<ReturnType<F>>, DATA>
) {
  const {enabled = true, key, map, onError, onResult, when = 'mount'} = opts
  const [state, setState] = React.useState<{
    data?: DATA
    dataKey?: string
    error?: RPCError
    errorKey?: string
    loadCount: number
    loaded: boolean
  }>({loadCount: 0, loaded: false})

  // ignore out-of-order responses when reload fires while a load is in flight
  const requestID = React.useRef(0)
  const load = React.useEffectEvent(() => {
    const id = ++requestID.current
    const keyAtCall = key
    call(...args)
      .then((result: Awaited<ReturnType<F>>) => {
        if (requestID.current !== id) return
        const data = map(result)
        setState(s => ({
          data,
          dataKey: keyAtCall,
          error: undefined,
          errorKey: undefined,
          loadCount: s.loadCount + 1,
          loaded: true,
        }))
        onResult?.(data)
      })
      .catch((error: RPCError) => {
        if (requestID.current !== id) return
        setState(s => ({...s, error, errorKey: keyAtCall, loaded: true}))
        onError?.(error)
      })
  })

  const setData = React.useEffectEvent(
    (next: DATA | undefined | ((prev: DATA | undefined) => DATA | undefined)) => {
      const keyNow = key
      setState(s => {
        const prev = key !== undefined && s.dataKey !== keyNow ? undefined : s.data
        return {
          ...s,
          data: typeof next === 'function' ? (next as (p: DATA | undefined) => DATA | undefined)(prev) : next,
          dataKey: keyNow,
        }
      })
    }
  )

  const autoLoad = React.useEffectEvent(() => {
    if (enabled) load()
  })
  // `when` and key-presence are locked at mount so the subscriptions stay stable
  const [onMountOrFocus] = React.useState(() => ({
    focus: () => {
      if (when === 'focus') autoLoad()
      return undefined
    },
    mount: () => {
      // keyed loads fire from the key effect below instead
      if (when === 'mount' && key === undefined) autoLoad()
    },
  }))
  C.useOnMountOnce(onMountOrFocus.mount)
  C.Router2.useSafeFocusEffect(onMountOrFocus.focus)
  const keyed = key !== undefined
  React.useEffect(() => {
    if (keyed && when !== 'manual') autoLoad()
  }, [keyed, when, key])

  const data = keyed ? (state.dataKey === key ? state.data : undefined) : state.data
  const error = keyed ? (state.errorKey === key ? state.error : undefined) : state.error
  const loaded = keyed
    ? state.dataKey === key || (state.error !== undefined && state.errorKey === key)
    : state.loaded

  // useEffectEvent returns a NEW wrapper identity every render (only its inner ref is
  // stable), so handing load/setData out directly poisons consumers' dep arrays and can
  // loop effects. Freeze the first wrapper; it stays valid because all wrappers share
  // the same ref.
  const [stableApi] = React.useState(() => ({
    reload: () => load(),
    setData: (next: Parameters<typeof setData>[0]) => setData(next),
  }))

  return {
    data,
    error,
    loadCount: state.loadCount,
    loaded,
    loading: enabled && !loaded,
    reload: stableApi.reload,
    setData: stableApi.setData,
  }
}
