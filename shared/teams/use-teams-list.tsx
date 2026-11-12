import * as C from '@/constants'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import * as T from '@/constants/types'
import {loadRpcIfStale, refreshRpc, useRpcData} from '@/query'

type TeamsList = {
  reload: () => void
  teams: ReadonlyArray<T.Teams.TeamMeta>
}

type TeamsRoleMap = {
  loadIfStale: () => Promise<void>
  roleMap: T.RPCGen.TeamRoleMapAndVersion
}

const emptyTeams: ReadonlyArray<T.Teams.TeamMeta> = []
const emptyTeamRoleMap = Object.freeze<T.RPCGen.TeamRoleMapAndVersion>({teams: undefined, version: 0})
const staleMs = 5 * 60_000

const useWarnUnlessNetwork = (what: string, error: unknown) => {
  React.useEffect(() => {
    if (error && (error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
      logger.warn(`Failed to load ${what}`, error)
    }
  }, [error, what])
}

// Incoming team chat messages fire teamMetadataUpdate, which reloads the list; the result is
// usually deep-equal to what we have. The cache keeps prior identities (the whole array when
// nothing changed), so consumers like TeamsRoot can bail.
const toTeams = (result: T.RPCGen.AnnotatedTeamList | null): ReadonlyArray<T.Teams.TeamMeta> => [
  ...Teams.teamListToMeta(result?.teams ?? []).values(),
]

export const invalidateLoadedTeams = () => {
  refreshRpc(T.RPCGen.teamsTeamListUnverifiedRpcPromise)
  refreshRpc(T.RPCGen.teamsGetTeamRoleMapRpcPromise)
}

const useTeamsListData = (load: boolean): TeamsList => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const {data: teams = emptyTeams, error} = useRpcData(
    T.RPCGen.teamsTeamListUnverifiedRpcPromise,
    {includeImplicitTeams: false, userAssertion: username},
    {enabled: !!username && loggedIn, load, select: toTeams, staleMs, waitingKey: C.waitingKeyTeamsLoaded}
  )
  useWarnUnlessNetwork('teams list', error)
  return React.useMemo(() => ({reload: invalidateLoadedTeams, teams}), [teams])
}

const loadRoleMapIfStale = async () => loadRpcIfStale(T.RPCGen.teamsGetTeamRoleMapRpcPromise, undefined, staleMs)

const useTeamsRoleMapData = (load: boolean): TeamsRoleMap => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const {data: roleMap = emptyTeamRoleMap, error} = useRpcData(
    T.RPCGen.teamsGetTeamRoleMapRpcPromise,
    undefined,
    {enabled: !!username && loggedIn, load, staleMs}
  )
  useWarnUnlessNetwork('teams role map', error)
  return React.useMemo(() => ({loadIfStale: loadRoleMapIfStale, roleMap}), [roleMap])
}

// The one place that loads both, and keeps them reloading on the service's notices
export const LoadedTeamsListProvider = (props: React.PropsWithChildren) => {
  useTeamsListData(true)
  useTeamsRoleMapData(true)
  return <>{props.children}</>
}

// Readers share the provider's load and never start one. The cache is one per app, so they work
// in popup portals outside the provider too.
export const useTeamsList = () => useTeamsListData(false)
export const useTeamsRoleMap = () => useTeamsRoleMapData(false)

export const useTeamsListMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.id, team] as const)), [teams])
}

export const useTeamsListNameToIDMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
}
