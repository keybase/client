import type * as T from '@/constants/types'
import type {DebouncedFunc} from 'lodash'
import debounce from 'lodash/debounce'
import {useEngineActionListener} from '@/engine/action-listener'

export const teamGone = (kinds: T.RPCGen.TeamChangedKinds) => kinds.exited || kinds.deleted

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

// Per-team debounce for reloads driven by teamChanged. One change can reach a
// team as a burst of notices (a bulk add or a bulk channel create sends one
// each), each of which would otherwise supersede the load before it: leading so
// a lone change lands at once, trailing so the rest of a burst costs one more
// load, maxWait so a team that is never quiet still reloads.
export const makeTeamReloadDebouncer = (run: (teamID: T.Teams.TeamID) => void) => {
  const debouncers = new Map<T.Teams.TeamID, DebouncedFunc<() => void>>()
  return {
    cancel: (teamID: T.Teams.TeamID) => {
      debouncers.get(teamID)?.cancel()
      debouncers.delete(teamID)
    },
    cancelAll: () => {
      debouncers.forEach(debounced => debounced.cancel())
      debouncers.clear()
    },
    schedule: (teamID: T.Teams.TeamID) => {
      let debounced = debouncers.get(teamID)
      if (!debounced) {
        debounced = debounce(() => run(teamID), 1000, {leading: true, maxWait: 5000, trailing: true})
        debouncers.set(teamID, debounced)
      }
      debounced()
    },
  }
}
