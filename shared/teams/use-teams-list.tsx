import * as C from '@/constants'
import type {DebouncedFunc} from 'lodash'
import debounce from 'lodash/debounce'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/constants/teams'
import {ensureError} from '@/util/errors'
import {useEngineActionListener} from '@/engine/action-listener'
import * as React from 'react'
import * as T from '@/constants/types'
import {
  type CachedResourceCache,
  createCachedResourceCache,
  useCachedResource,
} from './use-cached-resource'
import {registerExternalResetter} from '@/util/zustand'

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

const teamsListInvalidationListeners = new Set<() => void>()
const teamsRoleMapInvalidationListeners = new Set<() => void>()
const teamsListCache = createCachedResourceCache<ReadonlyArray<T.Teams.TeamMeta>, string | undefined>(
  emptyTeams,
  undefined
)
const teamsRoleMapCache = createCachedResourceCache<T.RPCGen.TeamRoleMapAndVersion, string | undefined>(
  emptyTeamRoleMap,
  undefined
)

// module scope outlives sign-out; both are keyed by username, so the next user
// would briefly render the previous user's team list and role map
registerExternalResetter('teams-list-caches', () => {
  teamsListCache.reset(emptyTeams, undefined)
  teamsRoleMapCache.reset(emptyTeamRoleMap, undefined)
})

const teamListToArray = (list: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo>) => {
  return [...Teams.teamListToMeta(list).values()]
}

// Incoming team chat messages fire teamMetadataUpdate, which reloads this list; the
// result is usually deep-equal to what we have. Reuse prior identities (the whole
// array when nothing changed) so context consumers like TeamsRoot can bail.
const recycleTeamList = (
  old: ReadonlyArray<T.Teams.TeamMeta>,
  next: Array<T.Teams.TeamMeta>
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

const invalidateCachedResource = <T, K>(cache: CachedResourceCache<T, K>, nextKey: K) => {
  cache.invalidate(nextKey)
}

export const invalidateLoadedTeams = () => {
  const username = useCurrentUserState.getState().username
  const loggedIn = useConfigState.getState().loggedIn
  if (!loggedIn || !username) {
    return
  }
  invalidateCachedResource(teamsListCache, username)
  invalidateCachedResource(teamsRoleMapCache, username)
  teamsListInvalidationListeners.forEach(listener => listener())
  teamsRoleMapInvalidationListeners.forEach(listener => listener())
}

// reload whenever the service signals a team change or invalidateLoadedTeams fires
const useReloadOnTeamChanges = (
  enabled: boolean,
  reload: () => unknown,
  invalidationListeners: Set<() => void>,
  includeMetadataUpdate = false
) => {
  const reloadNow = React.useEffectEvent(() => {
    if (enabled) {
      void reload()
    }
  })
  // service notifications arrive in bursts (one logical change can fire metadata,
  // role map, and changedByID); coalesce so a burst costs at most a leading and
  // a trailing reload instead of one per event. Lazy ref init is the sanctioned
  // create-once exception: a restarted render just recreates the debouncer.
  const debouncedReloadRef = React.useRef<DebouncedFunc<() => void> | null>(null)
  if (debouncedReloadRef.current == null) {
    debouncedReloadRef.current = debounce(() => reloadNow(), 2000, {leading: true, trailing: true})
  }
  React.useEffect(() => {
    return () => {
      debouncedReloadRef.current?.cancel()
    }
  }, [])
  const onChange = () => {
    debouncedReloadRef.current?.()
  }
  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (includeMetadataUpdate) {
      onChange()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', onChange)
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', onChange)
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', onChange)
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', onChange)

  React.useEffect(() => {
    if (!enabled) {
      return
    }
    const listener = () => {
      void reload()
    }
    invalidationListeners.add(listener)
    return () => {
      invalidationListeners.delete(listener)
    }
  }, [enabled, reload, invalidationListeners])
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
          [{includeImplicitTeams: false, userAssertion: username}, C.waitingKeyTeamsLoaded],
          result => resolve(recycleTeamList(teamsListCache.getData(), teamListToArray(result.teams ?? []))),
          error => reject(ensureError(error))
        )
      }),
    onError: error => {
      if ((error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
        logger.warn('Failed to load teams list', error)
      }
    },
    staleMs: teamsListReloadStaleMs,
  })

  useReloadOnTeamChanges(enabled, reload, teamsListInvalidationListeners, true)

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
    cache: teamsRoleMapCache,
    cacheKey: username,
    enabled: enabled && !!username && loggedIn,
    initialData: emptyTeamRoleMap,
    load: async () =>
      new Promise<T.RPCGen.TeamRoleMapAndVersion>((resolve, reject) => {
        loadRoleMapRPC(
          [undefined],
          result => resolve(result),
          error => reject(ensureError(error))
        )
      }),
    onError: error => {
      if ((error as {code?: number}).code !== T.RPCGen.StatusCode.scapinetworkerror) {
        logger.warn('Failed to load teams role map', error)
      }
    },
    staleMs: teamsListReloadStaleMs,
  })

  useReloadOnTeamChanges(enabled, reload, teamsRoleMapInvalidationListeners)

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
  const teams = teamsListCache.getData()
  const fallback = React.useMemo(() => ({reload: noopLoad, teams}), [teams])
  return context ?? fallback
}

// useTeamsRoleMap and useTeamsListMap are reachable from mobile popup portals
// (popup-root and the bottom-sheet host are siblings to the router, outside
// LoadedTeamsListProvider), so they fall back to the module cache instead of
// throwing. The cache stays fresh because the provider is mounted elsewhere.
export const useTeamsRoleMap = (): TeamsRoleMap => {
  const context = React.useContext(TeamsRoleMapContext)
  const roleMap = teamsRoleMapCache.getData()
  const fallback = React.useMemo(() => ({loadIfStale: noopLoad, reload: noopLoad, roleMap}), [roleMap])
  return context ?? fallback
}

export const useTeamsListMap = () => {
  const context = React.useContext(TeamsListContext)
  const teams = context?.teams ?? teamsListCache.getData()
  return React.useMemo(() => new Map(teams.map(team => [team.id, team] as const)), [teams])
}

export const useTeamsListNameToIDMap = () => {
  // NameWithIcon is a common-adapter that can render inside mobile popup portals
  // (popup-root is a sibling to the router, outside LoadedTeamsListProvider), so
  // fall back to the module cache instead of throwing when there's no provider.
  const context = React.useContext(TeamsListContext)
  const teams = context?.teams ?? teamsListCache.getData()
  return React.useMemo(() => new Map(teams.map(team => [team.teamname, team.id] as const)), [teams])
}
