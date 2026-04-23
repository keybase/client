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

type TeamsRoleMap = {
  loadIfStale: () => Promise<void>
  reload: () => Promise<void>
  roleMap: T.RPCGen.TeamRoleMapAndVersion
}

const emptyTeams: ReadonlyArray<T.Teams.TeamMeta> = []
const emptyTeamRoleMap = Object.freeze<T.RPCGen.TeamRoleMapAndVersion>({teams: undefined, version: 0})
const TeamsListContext = React.createContext<TeamsList | null>(null)
const TeamsRoleMapContext = React.createContext<TeamsRoleMap | null>(null)
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

  return React.useMemo(() => ({reload, teams}), [reload, teams])
}

const useTeamsRoleMapRaw = (enabled = true): TeamsRoleMap => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadRoleMapRPC = C.useRPC(T.RPCGen.teamsGetTeamRoleMapRpcPromise)
  const [roleMap, setRoleMap] = React.useState<T.RPCGen.TeamRoleMapAndVersion>(emptyTeamRoleMap)
  const requestVersionRef = React.useRef(0)
  const hasFocusedSinceMountRef = React.useRef(false)
  const inFlightRef = React.useRef<Promise<void> | undefined>(undefined)
  const loadedAtRef = React.useRef(0)

  const loadRoleMap = React.useEffectEvent(async (force: boolean) => {
    if (!enabled || !loggedIn || !username) {
      requestVersionRef.current++
      loadedAtRef.current = 0
      setRoleMap(emptyTeamRoleMap)
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
      loadRoleMapRPC(
        [undefined],
        result => {
          if (requestVersion === requestVersionRef.current) {
            loadedAtRef.current = Date.now()
            setRoleMap(result)
          }
          resolve()
        },
        error => {
          if (requestVersion === requestVersionRef.current && error.code !== T.RPCGen.StatusCode.scapinetworkerror) {
            logger.warn('Failed to load teams role map', error)
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

  const reload = React.useCallback(async () => {
    await loadRoleMap(true)
  }, [])

  const loadIfStale = React.useCallback(async () => {
    await loadRoleMap(false)
  }, [])

  React.useEffect(() => {
    void loadIfStale()
  }, [enabled, loadIfStale, loggedIn, username])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (!enabled) {
        return
      }
      if (hasFocusedSinceMountRef.current) {
        void loadIfStale()
      } else {
        hasFocusedSinceMountRef.current = true
      }
    }, [enabled, loadIfStale])
  )

  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', () => {
    if (enabled) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', () => {
    if (enabled) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', () => {
    if (enabled) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', () => {
    if (enabled) {
      void reload()
    }
  })

  return React.useMemo(() => ({loadIfStale, reload, roleMap}), [loadIfStale, reload, roleMap])
}

export const LoadedTeamsListProvider = (props: React.PropsWithChildren) => {
  const teamsList = useTeamsListRaw()
  const teamsRoleMap = useTeamsRoleMapRaw()
  return (
    <TeamsListContext.Provider value={teamsList}>
      <TeamsRoleMapContext.Provider value={teamsRoleMap}>{props.children}</TeamsRoleMapContext.Provider>
    </TeamsListContext.Provider>
  )
}

export const useTeamsList = (): TeamsList => {
  const context = React.useContext(TeamsListContext)
  const raw = useTeamsListRaw(!context)
  return context ?? raw
}

export const useTeamsRoleMap = (): TeamsRoleMap => {
  const context = React.useContext(TeamsRoleMapContext)
  const raw = useTeamsRoleMapRaw(!context)
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
