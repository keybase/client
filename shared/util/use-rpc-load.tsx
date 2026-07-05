import * as React from 'react'
import * as C from '@/constants'
import type {RPCError} from './errors'

type Options<RESULT, DATA> = {
  /** skips the mount/focus auto-load when false, checked when the trigger fires. reload() ignores this */
  enabled?: boolean
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
 * @returns data: mapped result of the last successful load
 * @returns error: error from the last load, cleared on the next success
 * @returns loaded: true once any load attempt finished (success or error)
 * @returns loadCount: number of successful loads, useful as a refresh token
 * @returns reload: kick off a load manually
 */
export function useRPCLoad<F extends (...rest: any[]) => Promise<any>, DATA>(
  call: F,
  args: Parameters<F>,
  opts: Options<Awaited<ReturnType<F>>, DATA>
) {
  const {enabled = true, map, onError, onResult, when = 'mount'} = opts
  const [state, setState] = React.useState<{
    data?: DATA
    error?: RPCError
    loadCount: number
    loaded: boolean
  }>({loadCount: 0, loaded: false})

  // ignore out-of-order responses when reload fires while a load is in flight
  const requestID = React.useRef(0)
  const load = React.useEffectEvent(() => {
    const id = ++requestID.current
    call(...args)
      .then((result: Awaited<ReturnType<F>>) => {
        if (requestID.current !== id) return
        const data = map(result)
        setState(s => ({data, error: undefined, loadCount: s.loadCount + 1, loaded: true}))
        onResult?.(data)
      })
      .catch((error: RPCError) => {
        if (requestID.current !== id) return
        setState(s => ({...s, error, loaded: true}))
        onError?.(error)
      })
  })

  const autoLoad = React.useEffectEvent(() => {
    if (enabled) load()
  })
  // `when` is locked at mount so the focus subscription can stay stable
  const [onMountOrFocus] = React.useState(() => ({
    focus: () => {
      if (when === 'focus') autoLoad()
      return undefined
    },
    mount: () => {
      if (when === 'mount') autoLoad()
    },
  }))
  C.useOnMountOnce(onMountOrFocus.mount)
  C.Router2.useSafeFocusEffect(onMountOrFocus.focus)

  return {...state, reload: load}
}
