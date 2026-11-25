import type * as T from '@/constants/types'
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
