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

// calls onChange with what changed, for changes to this team or to any of these teams
export const useTeamChanged = (
  teams: T.Teams.TeamID | ReadonlySet<T.Teams.TeamID> | undefined,
  onChange: (kinds: T.RPCGen.TeamChangedKinds) => void,
  enabled = true
) => {
  useEngineActionListener(
    'keybase.1.NotifyTeam.teamChanged',
    action => {
      const {kinds, teamID: changedTeamID} = action.payload.params
      if (typeof teams === 'string' ? changedTeamID === teams : teams?.has(changedTeamID)) {
        onChange(kinds)
      }
    },
    enabled && (typeof teams === 'string' ? !!teams : !!teams?.size)
  )
}

// For reloads driven by teamChanged, debounced by the rpc data cache. One change can reach a team
// as a burst of notices (a bulk add or a bulk channel create sends one each): a lone change lands
// at once, the rest of a burst costs one more load, and a team that is never quiet still reloads
// (every 5 debounces, the cache's max wait).
export const teamReloadDebounceMs = 1000
