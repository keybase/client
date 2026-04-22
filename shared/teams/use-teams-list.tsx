import * as C from '@/constants'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/stores/teams'
import {useEngineActionListener} from '@/engine/action-listener'
import * as React from 'react'
import * as T from '@/constants/types'

type TeamsList = {
  reload: () => void
  teams: ReadonlyArray<T.Teams.TeamMeta>
}

const emptyTeams: ReadonlyArray<T.Teams.TeamMeta> = []
const TeamsListContext = React.createContext<TeamsList | null>(null)

const teamListToArray = (list: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo>) => {
  return [...Teams.teamListToMeta(list).values()]
}

const useTeamsListRaw = (enabled = true): TeamsList => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadTeamsRPC = C.useRPC(T.RPCGen.teamsTeamListUnverifiedRpcPromise)
  const [teams, setTeams] = React.useState<ReadonlyArray<T.Teams.TeamMeta>>(emptyTeams)
  const requestVersionRef = React.useRef(0)
  const hasFocusedSinceMountRef = React.useRef(false)

  const reload = React.useCallback(() => {
    if (!enabled || !username || !loggedIn) {
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
  }, [enabled, loadTeamsRPC, loggedIn, username])

  React.useEffect(() => {
    reload()
  }, [reload])

  C.Router2.useSafeFocusEffect(() => {
    if (!enabled) {
      return
    }
    if (hasFocusedSinceMountRef.current) {
      reload()
    } else {
      hasFocusedSinceMountRef.current = true
    }
  })

  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled) {
      reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', () => {
    if (enabled) {
      reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', () => {
    if (enabled) {
      reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', () => {
    if (enabled) {
      reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', () => {
    if (enabled) {
      reload()
    }
  })

  return {reload, teams}
}

export const LoadedTeamsListProvider = (props: React.PropsWithChildren) => {
  const value = useTeamsListRaw()
  return <TeamsListContext.Provider value={value}>{props.children}</TeamsListContext.Provider>
}

export const useTeamsList = (): TeamsList => {
  const context = React.useContext(TeamsListContext)
  const raw = useTeamsListRaw(!context)
  return context ?? raw
}

export const useTeamsListMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.id, team] as const)), [teams])
}

export const useTeamsListNameToIDMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
}
