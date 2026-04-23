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

type TeamsAnnotatedTeam = {
  loadIfStale: (teamID: T.Teams.TeamID) => Promise<T.RPCGen.AnnotatedTeam | undefined>
  reload: (teamID: T.Teams.TeamID) => Promise<T.RPCGen.AnnotatedTeam | undefined>
}

type TeamsMembers = {
  loadIfStale: (teamID: T.Teams.TeamID) => Promise<ReadonlyArray<T.RPCGen.TeamMemberDetails> | undefined>
  reload: (teamID: T.Teams.TeamID) => Promise<ReadonlyArray<T.RPCGen.TeamMemberDetails> | undefined>
}

const emptyTeams: ReadonlyArray<T.Teams.TeamMeta> = []
const emptyTeamRoleMap = Object.freeze<T.RPCGen.TeamRoleMapAndVersion>({teams: undefined, version: 0})
const TeamsListContext = React.createContext<TeamsList | null>(null)
const TeamsRoleMapContext = React.createContext<TeamsRoleMap | null>(null)
const TeamsAnnotatedTeamContext = React.createContext<TeamsAnnotatedTeam | null>(null)
const TeamsMembersContext = React.createContext<TeamsMembers | null>(null)
const teamsListReloadStaleMs = 5 * 60_000
const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

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

const useTeamsAnnotatedTeamRaw = (enabled = true): TeamsAnnotatedTeam => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadAnnotatedTeamRPC = C.useRPC(T.RPCGen.teamsGetAnnotatedTeamRpcPromise)
  const annotatedTeamsRef = React.useRef(new Map<T.Teams.TeamID, T.RPCGen.AnnotatedTeam>())
  const requestVersionRef = React.useRef(new Map<T.Teams.TeamID, number>())
  const inFlightRef = React.useRef(new Map<T.Teams.TeamID, Promise<T.RPCGen.AnnotatedTeam | undefined>>())
  const loadedAtRef = React.useRef(new Map<T.Teams.TeamID, number>())

  const clearTeam = React.useCallback((teamID: T.Teams.TeamID) => {
    requestVersionRef.current.set(teamID, (requestVersionRef.current.get(teamID) ?? 0) + 1)
    annotatedTeamsRef.current.delete(teamID)
    inFlightRef.current.delete(teamID)
    loadedAtRef.current.delete(teamID)
  }, [])

  const clearAll = React.useCallback(() => {
    requestVersionRef.current = new Map()
    annotatedTeamsRef.current = new Map()
    inFlightRef.current = new Map()
    loadedAtRef.current = new Map()
  }, [])

  const loadAnnotatedTeam = React.useEffectEvent(
    async (teamID: T.Teams.TeamID, force: boolean): Promise<T.RPCGen.AnnotatedTeam | undefined> => {
      const validTeamID = loadableTeamID(teamID)
      if (!validTeamID) {
        return undefined
      }
      if (!enabled || !loggedIn || !username) {
        clearAll()
        return undefined
      }
      const cached = annotatedTeamsRef.current.get(validTeamID)
      const loadedAt = loadedAtRef.current.get(validTeamID) ?? 0
      if (!force && cached && loadedAt && Date.now() - loadedAt < teamsListReloadStaleMs) {
        return cached
      }
      const inFlight = inFlightRef.current.get(validTeamID)
      if (inFlight) {
        return inFlight
      }
      const requestVersion = (requestVersionRef.current.get(validTeamID) ?? 0) + 1
      requestVersionRef.current.set(validTeamID, requestVersion)
      const request = new Promise<T.RPCGen.AnnotatedTeam | undefined>(resolve => {
        loadAnnotatedTeamRPC(
          [{teamID: validTeamID}],
          result => {
            if (requestVersionRef.current.get(validTeamID) === requestVersion) {
              annotatedTeamsRef.current.set(validTeamID, result)
              loadedAtRef.current.set(validTeamID, Date.now())
            }
            resolve(annotatedTeamsRef.current.get(validTeamID))
          },
          error => {
            if (requestVersionRef.current.get(validTeamID) === requestVersion) {
              logger.warn(`Failed to load annotated team for ${validTeamID}`, error)
            }
            resolve(annotatedTeamsRef.current.get(validTeamID))
          }
        )
      })
      inFlightRef.current.set(validTeamID, request)
      try {
        return await request
      } finally {
        if (inFlightRef.current.get(validTeamID) === request) {
          inFlightRef.current.delete(validTeamID)
        }
      }
    }
  )

  const reload = React.useCallback(
    async (teamID: T.Teams.TeamID) => await loadAnnotatedTeam(teamID, true),
    []
  )

  const loadIfStale = React.useCallback(
    async (teamID: T.Teams.TeamID) => await loadAnnotatedTeam(teamID, false),
    []
  )

  React.useEffect(() => {
    if (!enabled || !loggedIn || !username) {
      clearAll()
    }
  }, [clearAll, enabled, loggedIn, username])

  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled) {
      clearAll()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled) {
      clearTeam(action.payload.params.teamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled) {
      clearTeam(action.payload.params.teamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled) {
      clearTeam(action.payload.params.teamID)
    }
  })

  return React.useMemo(() => ({loadIfStale, reload}), [loadIfStale, reload])
}

const useTeamsMembersRaw = (enabled = true): TeamsMembers => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadMembersRPC = C.useRPC(T.RPCGen.teamsTeamGetMembersByIDRpcPromise)
  const membersRef = React.useRef(new Map<T.Teams.TeamID, ReadonlyArray<T.RPCGen.TeamMemberDetails>>())
  const requestVersionRef = React.useRef(new Map<T.Teams.TeamID, number>())
  const inFlightRef = React.useRef(
    new Map<T.Teams.TeamID, Promise<ReadonlyArray<T.RPCGen.TeamMemberDetails> | undefined>>()
  )
  const loadedAtRef = React.useRef(new Map<T.Teams.TeamID, number>())

  const clearTeam = React.useCallback((teamID: T.Teams.TeamID) => {
    requestVersionRef.current.set(teamID, (requestVersionRef.current.get(teamID) ?? 0) + 1)
    membersRef.current.delete(teamID)
    inFlightRef.current.delete(teamID)
    loadedAtRef.current.delete(teamID)
  }, [])

  const clearAll = React.useCallback(() => {
    requestVersionRef.current = new Map()
    membersRef.current = new Map()
    inFlightRef.current = new Map()
    loadedAtRef.current = new Map()
  }, [])

  const loadMembers = React.useEffectEvent(
    async (teamID: T.Teams.TeamID, force: boolean): Promise<ReadonlyArray<T.RPCGen.TeamMemberDetails> | undefined> => {
      const validTeamID = loadableTeamID(teamID)
      if (!validTeamID) {
        return undefined
      }
      if (!enabled || !loggedIn || !username) {
        clearAll()
        return undefined
      }
      const cached = membersRef.current.get(validTeamID)
      const loadedAt = loadedAtRef.current.get(validTeamID) ?? 0
      if (!force && cached && loadedAt && Date.now() - loadedAt < teamsListReloadStaleMs) {
        return cached
      }
      const inFlight = inFlightRef.current.get(validTeamID)
      if (inFlight) {
        return inFlight
      }
      const requestVersion = (requestVersionRef.current.get(validTeamID) ?? 0) + 1
      requestVersionRef.current.set(validTeamID, requestVersion)
      const request = new Promise<ReadonlyArray<T.RPCGen.TeamMemberDetails> | undefined>(resolve => {
        loadMembersRPC(
          [{id: validTeamID}],
          result => {
            if (requestVersionRef.current.get(validTeamID) === requestVersion) {
              membersRef.current.set(validTeamID, result ?? [])
              loadedAtRef.current.set(validTeamID, Date.now())
            }
            resolve(membersRef.current.get(validTeamID))
          },
          error => {
            if (requestVersionRef.current.get(validTeamID) === requestVersion) {
              logger.warn(`Failed to load team members for ${validTeamID}`, error)
            }
            resolve(membersRef.current.get(validTeamID))
          }
        )
      })
      inFlightRef.current.set(validTeamID, request)
      try {
        return await request
      } finally {
        if (inFlightRef.current.get(validTeamID) === request) {
          inFlightRef.current.delete(validTeamID)
        }
      }
    }
  )

  const reload = React.useCallback(async (teamID: T.Teams.TeamID) => await loadMembers(teamID, true), [])

  const loadIfStale = React.useCallback(
    async (teamID: T.Teams.TeamID) => await loadMembers(teamID, false),
    []
  )

  React.useEffect(() => {
    if (!enabled || !loggedIn || !username) {
      clearAll()
    }
  }, [clearAll, enabled, loggedIn, username])

  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled) {
      clearTeam(action.payload.params.teamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled) {
      clearTeam(action.payload.params.teamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled) {
      clearTeam(action.payload.params.teamID)
    }
  })

  return React.useMemo(() => ({loadIfStale, reload}), [loadIfStale, reload])
}

export const LoadedTeamsListProvider = (props: React.PropsWithChildren) => {
  const teamsList = useTeamsListRaw()
  const teamsRoleMap = useTeamsRoleMapRaw()
  const teamsAnnotatedTeam = useTeamsAnnotatedTeamRaw()
  const teamsMembers = useTeamsMembersRaw()
  return (
    <TeamsListContext.Provider value={teamsList}>
      <TeamsRoleMapContext.Provider value={teamsRoleMap}>
        <TeamsAnnotatedTeamContext.Provider value={teamsAnnotatedTeam}>
          <TeamsMembersContext.Provider value={teamsMembers}>{props.children}</TeamsMembersContext.Provider>
        </TeamsAnnotatedTeamContext.Provider>
      </TeamsRoleMapContext.Provider>
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

export const useTeamsAnnotatedTeam = (): TeamsAnnotatedTeam => {
  const context = React.useContext(TeamsAnnotatedTeamContext)
  const raw = useTeamsAnnotatedTeamRaw(!context)
  return context ?? raw
}

export const useTeamsMembers = (): TeamsMembers => {
  const context = React.useContext(TeamsMembersContext)
  const raw = useTeamsMembersRaw(!context)
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
