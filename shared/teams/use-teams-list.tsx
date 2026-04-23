import * as C from '@/constants'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/constants/teams'
import {useEngineActionListener} from '@/engine/action-listener'
import * as React from 'react'
import * as T from '@/constants/types'
import {createCachedResourceCache, useCachedResource} from './use-cached-resource'

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
const teamsListCache = createCachedResourceCache<ReadonlyArray<T.Teams.TeamMeta>, string | undefined>(
  emptyTeams,
  undefined
)
const teamsRoleMapCache = createCachedResourceCache<T.RPCGen.TeamRoleMapAndVersion, string | undefined>(
  emptyTeamRoleMap,
  undefined
)

const teamListToArray = (list: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo>) => {
  return [...Teams.teamListToMeta(list).values()]
}

const useTeamsListRaw = (enabled = true): TeamsList => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadTeamsRPC = C.useRPC(T.RPCGen.teamsTeamListUnverifiedRpcPromise)
  const {data: teams, reload} = useCachedResource({
    cache: teamsListCache,
    cacheKey: username,
    enabled: enabled && !!username && loggedIn,
    initialData: emptyTeams,
    load: async () =>
      new Promise<ReadonlyArray<T.Teams.TeamMeta>>((resolve, reject) => {
        loadTeamsRPC(
          [{includeImplicitTeams: false, userAssertion: username ?? ''}, C.waitingKeyTeamsLoaded],
          result => resolve(teamListToArray(result.teams ?? [])),
          error => reject(error)
        )
      }),
    onError: error => {
      if ((error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
        logger.warn('Failed to load teams list', error)
      }
    },
    staleMs: teamsListReloadStaleMs,
  })

  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled) {
      void reload()
    }
  })
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

  return React.useMemo(() => ({reload, teams}), [reload, teams])
}

const useTeamsRoleMapRaw = (enabled = true): TeamsRoleMap => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadRoleMapRPC = C.useRPC(T.RPCGen.teamsGetTeamRoleMapRpcPromise)
  const {data: roleMap, loadIfStale, reload} = useCachedResource({
    cache: teamsRoleMapCache,
    cacheKey: username,
    enabled: enabled && !!username && loggedIn,
    initialData: emptyTeamRoleMap,
    load: async () =>
      new Promise<T.RPCGen.TeamRoleMapAndVersion>((resolve, reject) => {
        loadRoleMapRPC([undefined], result => resolve(result), error => reject(error))
      }),
    onError: error => {
      if ((error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
        logger.warn('Failed to load teams role map', error)
      }
    },
    staleMs: teamsListReloadStaleMs,
  })

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
  if (!context) {
    throw new Error('useTeamsList must be used within LoadedTeamsListProvider')
  }
  return context
}

export const useTeamsRoleMap = (): TeamsRoleMap => {
  const context = React.useContext(TeamsRoleMapContext)
  if (!context) {
    throw new Error('useTeamsRoleMap must be used within LoadedTeamsListProvider')
  }
  return context
}

export const useTeamsListMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.id, team] as const)), [teams])
}

export const useTeamsListNameToIDMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
}
