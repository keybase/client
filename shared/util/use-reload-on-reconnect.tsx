import * as React from 'react'
import {useDaemonState} from '@/stores/daemon'

/**
 * Fires cb when the daemon handshake completes after this hook has observed a
 * different handshake state — i.e. on reconnect (engine reset re-runs the
 * handshake) or recovery from a failed handshake. Mounting while already
 * 'done' never fires. Engine resets orphan in-flight rpc promises (they never
 * settle), so data hooks use this to refire loads and unstick themselves.
 */
export const useReloadOnReconnect = (cb: () => void) => {
  const handshakeState = useDaemonState(s => s.handshakeState)
  const onReconnect = React.useEffectEvent(cb)
  const prevRef = React.useRef<typeof handshakeState | undefined>(undefined)
  React.useEffect(() => {
    const prev = prevRef.current
    prevRef.current = handshakeState
    if (handshakeState === 'done' && prev !== undefined && prev !== 'done') {
      onReconnect()
    }
  }, [handshakeState])
}
