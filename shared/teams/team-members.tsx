import * as C from '@/constants'
import type * as T from '@/constants/types'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'

export const useLoadTeamMembers = (teamID: T.Teams.TeamID, enabled = true) => {
  const lastRequestedTeamIDRef = React.useRef<T.Teams.TeamID | undefined>(undefined)
  const getMembers = useTeamsState(s => s.dispatch.getMembers)
  const loadableTeamID =
    teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined
  const missing = useTeamsState(s => enabled && !!loadableTeamID && !s.teamIDToMembers.has(loadableTeamID))

  React.useEffect(() => {
    if (!enabled || !loadableTeamID) {
      lastRequestedTeamIDRef.current = undefined
      return
    }
    if (!missing) {
      if (lastRequestedTeamIDRef.current === loadableTeamID) {
        lastRequestedTeamIDRef.current = undefined
      }
      return
    }
    if (lastRequestedTeamIDRef.current === loadableTeamID) {
      return
    }
    lastRequestedTeamIDRef.current = loadableTeamID
    C.ignorePromise(
      getMembers(loadableTeamID).finally(() => {
        if (lastRequestedTeamIDRef.current === loadableTeamID) {
          lastRequestedTeamIDRef.current = undefined
        }
      })
    )
  }, [enabled, getMembers, loadableTeamID, missing])
}

export const useTeamMembers = (teamID: T.Teams.TeamID) => useTeamsState(s => s.teamIDToMembers.get(teamID))
