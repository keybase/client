import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type Store = T.Immutable<{
  blockButtonsMap: ReadonlyMap<T.RPCGen.TeamID, T.Chat.BlockButtonsInfo>
  // Not read by the app. E2e waits on it, so an absent entry in blockButtonsMap means no buttons
  // rather than prefs that have yet to arrive.
  loaded: boolean
}>

const makeInitialStore = (): Store => ({
  blockButtonsMap: new Map(),
  loaded: false,
})

type State = Store & {
  dispatch: {
    resetState: () => void
    updateFromPrefs: (prefs: T.RPCGen.GregorUIPrefs) => void
  }
}

export const useBlockButtonsState = Z.createZustand<State>('block-buttons', set => {
  const dispatch: State['dispatch'] = {
    resetState: () => {
      set(s => ({...makeInitialStore(), dispatch: s.dispatch}))
    },
    updateFromPrefs: prefs => {
      set(s => {
        s.blockButtonsMap = new Map(
          Object.entries(prefs.blockButtonsAdders ?? {}).map(([teamID, adder]) => [teamID, {adder}])
        )
        s.loaded = true
      })
    },
  }

  return {
    ...makeInitialStore(),
    dispatch,
  }
})

export const useBlockButtonsInfo = (teamID: T.Teams.TeamID) =>
  useBlockButtonsState(s => s.blockButtonsMap.get(teamID))
