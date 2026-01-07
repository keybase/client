import type * as EngineGen from '@/actions/engine-gen-gen'
import * as Z from '@/util/zustand'
import {onEngineIncoming as onEngineIncomingShared} from '../platform-specific/shared'

type Store = {
  connectedTrigger: number
  disconnectedTrigger: number
}
const initialStore: Store = {
  connectedTrigger: 0,
  disconnectedTrigger: 0,
}

export interface State extends Store {
  dispatch: {
    onEngineConnected: () => void
    onEngineDisconnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const useEngineState = Z.createZustand<State>(set => {
  let incomingTimeout: NodeJS.Timeout
  const dispatch: State['dispatch'] = {
    onEngineConnected: () => {
      set(s => ({...s, connectedTrigger: s.connectedTrigger + 1}))
    },
    onEngineDisconnected: () => {
      set(s => ({...s, disconnectedTrigger: s.disconnectedTrigger + 1}))
    },
    onEngineIncoming: action => {
      // defer a frame so its more like before
      incomingTimeout = setTimeout(() => {
        // we delegate to these utils so we don't need to load stores that we don't need yet
        onEngineIncomingShared(action)
      }, 0)
    },
    resetState: () => {
      set(s => ({...s, ...initialStore, dispatch: s.dispatch}))
      clearTimeout(incomingTimeout)
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
