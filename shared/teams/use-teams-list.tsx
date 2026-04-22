import * as C from '@/constants'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/constants/teams'
import {useEngineActionListener} from '@/engine/action-listener'
import * as React from 'react'
import * as T from '@/constants/types'

type TeamsList = {
  reload: () => void
  teams: ReadonlyArray<T.Teams.TeamMeta>
}

const emptyTeams: ReadonlyArray<T.Teams.TeamMeta> = []
const TeamsListContext = React.createContext<TeamsList | null>(null)
const teamsListReloadStaleMs = 5 * 60_000

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
  const inFlightRef = React.useRef<Promise<void> | undefined>(undefined)
  const loadedAtRef = React.useRef(0)

  const loadTeams = React.useEffectEvent(async (force: boolean) => {
    if (!enabled || !username || !loggedIn) {
      requestVersionRef.current++
      loadedAtRef.current = 0
      setTeams(emptyTeams)
      return
    }
    if (!force && loadedAtRef.current && Date.now() - loadedAtRef.current < teamsListReloadStaleMs) {
      return
    }
    if (inFlightRef.current) {
      await inFlightRef.current
      return
    }
    const requestVersion = ++requestVersionRef.current
    const request = new Promise<void>(resolve => {
      loadTeamsRPC(
        [{includeImplicitTeams: false, userAssertion: username}, C.waitingKeyTeamsLoaded],
        result => {
          if (requestVersion === requestVersionRef.current) {
            loadedAtRef.current = Date.now()
            setTeams(teamListToArray(result.teams ?? []))
          }
          resolve()
        },
        error => {
          if (requestVersion === requestVersionRef.current && error.code !== T.RPCGen.StatusCode.scapinetworkerror) {
            logger.warn('Failed to load teams list', error)
          }
          resolve()
        }
      )
    })
    inFlightRef.current = request
    try {
      await request
    } finally {
      if (inFlightRef.current === request) {
        inFlightRef.current = undefined
      }
    }
  })

  const reload = React.useCallback(() => {
    void loadTeams(true)
  }, [])

  const loadIfStale = React.useCallback(() => {
    void loadTeams(false)
  }, [])

  React.useEffect(() => {
    loadIfStale()
  }, [enabled, loadIfStale, loggedIn, username])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (!enabled) {
        return
      }
      if (hasFocusedSinceMountRef.current) {
        loadIfStale()
      } else {
        hasFocusedSinceMountRef.current = true
      }
    }, [enabled, loadIfStale])
  )

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
