import type * as T from '@/constants/types'
import {subscribeToEngineAction, useEngineActionListener} from '@/engine/action-listener'

export const teamGone = (kinds: T.RPCGen.TeamChangedKinds) => kinds.exited || kinds.deleted

declare global {
  var __hmr_teamChangedUnsubs: Map<string, () => void> | undefined
}

// A module-scope teamChanged listener. `owner` names the module: a hot reload of it replaces its
// listener instead of adding another next to the old module's state.
export const subscribeTeamChanged = (
  owner: string,
  onChange: (kinds: T.RPCGen.TeamChangedKinds, teamID: T.Teams.TeamID) => void
) => {
  const unsubs = (globalThis.__hmr_teamChangedUnsubs ??= new Map<string, () => void>())
  unsubs.get(owner)?.()
  unsubs.set(
    owner,
    subscribeToEngineAction('keybase.1.NotifyTeam.teamChanged', action => {
      const {kinds, teamID} = action.payload.params
      onChange(kinds, teamID)
    })
  )
}

// calls onChange with what changed, for changes to this one team
export const useTeamChanged = (
  teamID: T.Teams.TeamID | undefined,
  onChange: (kinds: T.RPCGen.TeamChangedKinds) => void,
  enabled = true
) => {
  useEngineActionListener(
    'keybase.1.NotifyTeam.teamChanged',
    action => {
      const {kinds, teamID: changedTeamID} = action.payload.params
      if (changedTeamID === teamID) {
        onChange(kinds)
      }
    },
    enabled && !!teamID
  )
}

// For reloads driven by teamChanged, debounced by the rpc data cache. One change can reach a team
// as a burst of notices (a bulk add or a bulk channel create sends one each): a lone change lands
// at once, the rest of a burst costs one more load, and a team that is never quiet still reloads.
export const teamReloadDebounceMs = 1000
