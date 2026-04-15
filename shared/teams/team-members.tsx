import * as C from '@/constants'
import type * as T from '@/constants/types'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'

export const useLoadTeamMembers = (teamID: T.Teams.TeamID, enabled = true) => {
  const lastRequestedTeamIDRef = React.useRef<T.Teams.TeamID | undefined>(undefined)
  const getMembers = useTeamsState(s => s.dispatch.getMembers)
  const missing = useTeamsState(s => enabled && !!teamID && !s.teamIDToMembers.has(teamID))

  React.useEffect(() => {
    if (!enabled || !teamID) {
      lastRequestedTeamIDRef.current = undefined
      return
    }
    if (!missing) {
      if (lastRequestedTeamIDRef.current === teamID) {
        lastRequestedTeamIDRef.current = undefined
      }
      return
    }
    if (lastRequestedTeamIDRef.current === teamID) {
      return
    }
    lastRequestedTeamIDRef.current = teamID
    C.ignorePromise(getMembers(teamID))
  }, [enabled, getMembers, missing, teamID])
}

export const useTeamMembers = (teamID: T.Teams.TeamID) => useTeamsState(s => s.teamIDToMembers.get(teamID))
