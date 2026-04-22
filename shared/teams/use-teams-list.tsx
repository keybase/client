import * as C from '@/constants'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/stores/teams'
import * as React from 'react'
import * as T from '@/constants/types'

const emptyTeams: ReadonlyArray<T.Teams.TeamMeta> = []

const teamListToArray = (list: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo>) => {
  return [...Teams.teamListToMeta(list).values()]
}

export const useTeamsList = () => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadTeamsRPC = C.useRPC(T.RPCGen.teamsTeamListUnverifiedRpcPromise)
  const [teams, setTeams] = React.useState<ReadonlyArray<T.Teams.TeamMeta>>(emptyTeams)
  const requestVersionRef = React.useRef(0)
  const hasFocusedSinceMountRef = React.useRef(false)

  const reload = React.useCallback(() => {
    if (!username || !loggedIn) {
      requestVersionRef.current++
      setTeams(emptyTeams)
      return
    }
    const requestVersion = ++requestVersionRef.current
    loadTeamsRPC(
      [{includeImplicitTeams: false, userAssertion: username}, C.waitingKeyTeamsLoaded],
      result => {
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        setTeams(teamListToArray(result.teams ?? []))
      },
      error => {
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        if (error.code !== T.RPCGen.StatusCode.scapinetworkerror) {
          logger.warn('Failed to load teams list', error)
        }
      }
    )
  }, [loadTeamsRPC, loggedIn, username])

  React.useEffect(() => {
    reload()
  }, [reload])

  C.Router2.useSafeFocusEffect(() => {
    if (hasFocusedSinceMountRef.current) {
      reload()
    } else {
      hasFocusedSinceMountRef.current = true
    }
  })

  return {reload, teams}
}
