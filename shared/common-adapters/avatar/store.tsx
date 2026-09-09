import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {EnginePriority, registerEngineHandlers} from '@/engine/action-listener'

// This store has no dependencies on other stores and is safe to import directly from other stores.
type Store = T.Immutable<{
  counts: Map<string, number>
}>

const initialStore: Store = {
  counts: new Map(),
}

export type State = Store & {
  dispatch: {
    updated: (key: string) => void
    // used by remotes to update themselves
    replace: (m: Map<string, number>) => void
    resetState: () => void
  }
}

export const useAvatarState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    replace: m => {
      set(s => {
        s.counts = m
      })
    },
    resetState: Z.defaultReset,
    updated: key => {
      set(s => {
        s.counts.set(key, (s.counts.get(key) ?? 0) + 1)
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})

registerEngineHandlers(
  {
    'keybase.1.NotifyTeam.avatarUpdated': action => {
      useAvatarState.getState().dispatch.updated(action.payload.params.name)
    },
  },
  {id: 'common-adapters/avatar/store', priority: EnginePriority.shared}
)
