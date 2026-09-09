import * as C from '@/constants'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/constants/teams'
import {ensureError} from '@/util/errors'
import * as React from 'react'
import * as T from '@/constants/types'
import {
  type CachedResourceInvalidation,
  createCachedResourceNamespace,
  useCachedResource,
} from '@/util/use-cached-resource'

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

// Both are keyed by username, and every read goes through peek(currentUsername),
// so the previous user's list can never be rendered. Their entries are dropped by
// the namespace's sign-out reset, which is what keeps a re-login inside the stale
// window from being served them.
const teamsListResource = createCachedResourceNamespace<ReadonlyArray<T.Teams.TeamMeta>, string>(
  'teams-list-cache',
  () => emptyTeams
)
const teamsRoleMapResource = createCachedResourceNamespace<T.RPCGen.TeamRoleMapAndVersion, string>(
  'teams-role-map-cache',
  () => emptyTeamRoleMap
)

// Reads for consumers rendered outside the provider. Keyed on the current user
// so an entry the previous one left behind can never be rendered.
const peekTeams = () => {
  const username = useCurrentUserState.getState().username
  return username ? teamsListResource.peek(username) : emptyTeams
}
const peekRoleMap = () => {
  const username = useCurrentUserState.getState().username
  return username ? teamsRoleMapResource.peek(username) : emptyTeamRoleMap
}

// reload whenever the service signals a team change. One logical change fires
// several of these; useCachedResource coalesces the burst onto one reload.
const makeTeamChangeInvalidations = (includeMetadataUpdate: boolean) =>
  [
    ...(includeMetadataUpdate
      ? ([{type: 'keybase.1.NotifyTeam.teamMetadataUpdate'}] as const)
      : ([] as const)),
    {type: 'keybase.1.NotifyTeam.teamRoleMapChanged'},
    {type: 'keybase.1.NotifyTeam.teamChangedByID'},
    {type: 'keybase.1.NotifyTeam.teamDeleted'},
    {type: 'keybase.1.NotifyTeam.teamExit'},
  ] satisfies ReadonlyArray<CachedResourceInvalidation>

// Incoming team chat messages fire teamMetadataUpdate; only the list cares.
const teamsListInvalidations = makeTeamChangeInvalidations(true)
const teamsRoleMapInvalidations = makeTeamChangeInvalidations(false)

const teamListToArray = (list: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo>) => {
  return [...Teams.teamListToMeta(list).values()]
}

// Incoming team chat messages fire teamMetadataUpdate, which reloads this list; the
// result is usually deep-equal to what we have. Reuse prior identities (the whole
// array when nothing changed) so context consumers like TeamsRoot can bail.
const recycleTeamList = (
  old: ReadonlyArray<T.Teams.TeamMeta>,
  next: ReadonlyArray<T.Teams.TeamMeta>
): ReadonlyArray<T.Teams.TeamMeta> => {
  if (old.length === next.length && next.every((t, i) => isEqual(t, old[i]))) {
    return old
  }
  const oldByID = new Map(old.map(t => [t.id, t]))
  return next.map(t => {
    const o = oldByID.get(t.id)
    return o && isEqual(o, t) ? o : t
  })
}

export const invalidateLoadedTeams = () => {
  const username = useCurrentUserState.getState().username
  const loggedIn = useConfigState.getState().loggedIn
  if (!loggedIn || !username) {
    return
  }
  teamsListResource.invalidate(username)
  teamsRoleMapResource.invalidate(username)
}

const useTeamsListRaw = (enabled = true): TeamsList => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadTeamsRPC = C.useRPC(T.RPCGen.teamsTeamListUnverifiedRpcPromise)
  const {data: teams, reload} = useCachedResource({
    cacheKey: username || undefined,
    enabled: enabled && loggedIn,
    initialData: emptyTeams,
    invalidateOn: teamsListInvalidations,
    load: async () =>
      new Promise<ReadonlyArray<T.Teams.TeamMeta>>((resolve, reject) => {
        loadTeamsRPC(
          [{includeImplicitTeams: false, userAssertion: username}, C.waitingKeyTeamsLoaded],
          result => resolve(teamListToArray(result.teams ?? [])),
          error => reject(ensureError(error))
        )
      }),
    namespace: teamsListResource,
    onError: error => {
      if ((error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
        logger.warn('Failed to load teams list', error)
      }
    },
    recycle: recycleTeamList,
    staleMs: teamsListReloadStaleMs,
  })

  return React.useMemo(() => ({reload, teams}), [reload, teams])
}

const useTeamsRoleMapRaw = (enabled = true): TeamsRoleMap => {
  const username = useCurrentUserState(s => s.username)
  const loggedIn = useConfigState(s => s.loggedIn)
  const loadRoleMapRPC = C.useRPC(T.RPCGen.teamsGetTeamRoleMapRpcPromise)
  const {
    data: roleMap,
    loadIfStale,
    reload,
  } = useCachedResource({
    cacheKey: username || undefined,
    enabled: enabled && loggedIn,
    initialData: emptyTeamRoleMap,
    invalidateOn: teamsRoleMapInvalidations,
    load: async () =>
      new Promise<T.RPCGen.TeamRoleMapAndVersion>((resolve, reject) => {
        loadRoleMapRPC(
          [undefined],
          result => resolve(result),
          error => reject(ensureError(error))
        )
      }),
    namespace: teamsRoleMapResource,
    onError: error => {
      if ((error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
        logger.warn('Failed to load teams role map', error)
      }
    },
    staleMs: teamsListReloadStaleMs,
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

const noopLoad = async () => {}

// Fall back to the module cache instead of throwing: fast refresh re-evaluates
// this module and briefly splits the context identity between the mounted
// provider and refreshed consumers, and popup portals render outside the
// provider (see useTeamsRoleMap below).
export const useTeamsList = (): TeamsList => {
  const context = React.useContext(TeamsListContext)
  // read the cache every render (not a one-time snapshot) so provider-less
  // consumers still see fresh data; identity stays stable while data does
  const teams = peekTeams()
  const fallback = React.useMemo(() => ({reload: noopLoad, teams}), [teams])
  return context ?? fallback
}

// useTeamsRoleMap and useTeamsListMap are reachable from mobile popup portals
// (popup-root and the bottom-sheet host are siblings to the router, outside
// LoadedTeamsListProvider), so they fall back to the module cache instead of
// throwing. The cache stays fresh because the provider is mounted elsewhere.
export const useTeamsRoleMap = (): TeamsRoleMap => {
  const context = React.useContext(TeamsRoleMapContext)
  const roleMap = peekRoleMap()
  const fallback = React.useMemo(() => ({loadIfStale: noopLoad, reload: noopLoad, roleMap}), [roleMap])
  return context ?? fallback
}

export const useTeamsListMap = () => {
  const context = React.useContext(TeamsListContext)
  const teams = context?.teams ?? peekTeams()
  return React.useMemo(() => new Map(teams.map(team => [team.id, team] as const)), [teams])
}

export const useTeamsListNameToIDMap = () => {
  // NameWithIcon is a common-adapter that can render inside mobile popup portals
  // (popup-root is a sibling to the router, outside LoadedTeamsListProvider), so
  // fall back to the module cache instead of throwing when there's no provider.
  const context = React.useContext(TeamsListContext)
  const teams = context?.teams ?? peekTeams()
  return React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
}
