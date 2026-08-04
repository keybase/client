import * as React from 'react'
import {useDaemonState} from '@/stores/daemon'
import {nextReloadEpoch} from './reload-epoch'

// One reconnect is one event, however many hooks react to it, so all of them
// must be handed the same epoch - see reload-epoch. Consumers fire in separate
// effects, so the allocation is memoized on the handshake generation rather
// than done once at the call site.
let lastGeneration = -1
let lastEpoch = 0
const epochForGeneration = (generation: number) => {
  if (generation !== lastGeneration) {
    lastGeneration = generation
    lastEpoch = nextReloadEpoch()
  }
  return lastEpoch
}

/**
 * Fires cb when the daemon handshake completes after this hook has observed a
 * different handshake state — i.e. on reconnect (engine reset re-runs the
 * handshake) or recovery from a failed handshake. Mounting while already
 * 'done' never fires. Engine resets orphan in-flight rpc promises (they never
 * settle), so data hooks use this to refire loads and unstick themselves.
 * cb receives the epoch shared by every hook reacting to this same reconnect.
 */
export const useReloadOnReconnect = (cb: (epoch: number) => void) => {
  const handshakeState = useDaemonState(s => s.handshakeState)
  const onReconnect = React.useEffectEvent(cb)
  const prevRef = React.useRef<typeof handshakeState | undefined>(undefined)
  React.useEffect(() => {
    const prev = prevRef.current
    prevRef.current = handshakeState
    if (handshakeState === 'done' && prev !== undefined && prev !== 'done') {
      onReconnect(epochForGeneration(useDaemonState.getState().handshakeGeneration))
    }
  }, [handshakeState])
}
