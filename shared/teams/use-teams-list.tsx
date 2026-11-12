import * as C from '@/constants'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import * as T from '@/constants/types'
import {loadRpcIfStale, refreshRpc, useCachedRpcData, useRpcData} from '@/query'

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

const warnUnlessNetwork = (what: string) => (error: Error) => {
  if ((error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
    logger.warn(`Failed to load ${what}`, error)
  }
}
const warnTeamsList = warnUnlessNetwork('teams list')
const warnTeamsRoleMap = warnUnlessNetwork('teams role map')

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

const loadRoleMapIfStale = async () => loadRpcIfStale(T.RPCGen.teamsGetTeamRoleMapRpcPromise, undefined, staleMs)

// The one place that loads both, and keeps them reloading on the service's notices
export const LoadedTeamsListProvider = (props: React.PropsWithChildren) => {
  const username = useCurrentUserState(s => s.username)
  const enabled = useConfigState(s => s.loggedIn) && !!username
  useRpcData(
    T.RPCGen.teamsTeamListUnverifiedRpcPromise,
    {includeImplicitTeams: false, userAssertion: username},
    {enabled, onError: warnTeamsList, staleMs, waitingKey: C.waitingKeyTeamsLoaded}
  )
  useRpcData(T.RPCGen.teamsGetTeamRoleMapRpcPromise, undefined, {enabled, onError: warnTeamsRoleMap, staleMs})
  return <>{props.children}</>
}

// Readers share the provider's load and never start one. The cache is one per app, so they work
// in popup portals outside the provider too.
export const useTeamsList = (): TeamsList => {
  const username = useCurrentUserState(s => s.username)
  const teams =
    useCachedRpcData(
      T.RPCGen.teamsTeamListUnverifiedRpcPromise,
      {includeImplicitTeams: false, userAssertion: username},
      toTeams
    ) ?? emptyTeams
  return React.useMemo(() => ({reload: invalidateLoadedTeams, teams}), [teams])
}

export const useTeamsRoleMap = (): TeamsRoleMap => {
  const roleMap = useCachedRpcData(T.RPCGen.teamsGetTeamRoleMapRpcPromise, undefined) ?? emptyTeamRoleMap
  return React.useMemo(() => ({loadIfStale: loadRoleMapIfStale, roleMap}), [roleMap])
}

export const useTeamsListMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.id, team] as const)), [teams])
}

export const useTeamsListNameToIDMap = () => {
  const {teams} = useTeamsList()
  return React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
}
