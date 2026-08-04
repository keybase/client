import * as T from '@/constants/types'
import type {DebouncedFunc} from 'lodash'
import debounce from 'lodash/debounce'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import {useTeamsListMap, useTeamsRoleMap} from '../use-teams-list'
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '@/util/use-cached-resource'
import {registerExternalResetter} from '@/util/zustand'

type LoadedTeam = {
  loaded: boolean
  loading: boolean
  reload: () => Promise<void>
  teamDetails: T.Teams.TeamDetails
  teamMeta: T.Teams.TeamMeta
  yourOperations: T.Teams.TeamOperations
}

type LoadedTeamContextValue = LoadedTeam & {
  teamID: T.Teams.TeamID
}

type LoadedTeamData = Pick<LoadedTeam, 'teamDetails' | 'teamMeta'>
type LoadedTeamCacheMap = Map<
  T.Teams.TeamID | undefined,
  CachedResourceCache<LoadedTeamData, T.Teams.TeamID | undefined>
>

const LoadedTeamContext = React.createContext<LoadedTeamContextValue | null>(null)
const loadedTeamReloadStaleMs = 5_000

// One map for every consumer, for the same reason as the team channel cache: the
// stale window and the single-flight live on the cache object, so callers holding
// separate maps cannot see each other's in-flight request. While each provider
// and each provider-less consumer held its own map, 81% of getAnnotatedTeam calls
// in an e2e run landed inside their own 5s stale window - the team screen, the
// channel screen and any modal above them each paid a full 200ms team load.
const loadedTeamCache: LoadedTeamCacheMap = new Map()

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamData = (teamID?: T.Teams.TeamID): LoadedTeamData => ({
  teamDetails: Teams.emptyTeamDetails,
  teamMeta: teamID ? Teams.makeTeamMeta({id: teamID}) : Teams.emptyTeamMeta,
})

// module scope outlives sign-out and this is per-user team data
registerExternalResetter('loaded-team-cache', () => {
  loadedTeamCache.forEach((cache, teamID) => cache.reset(emptyLoadedTeamData(teamID), teamID))
  loadedTeamCache.clear()
})

const roleAndDetailsFromMap = (
  map: T.RPCGen.TeamRoleMapAndVersion,
  teamID: T.Teams.TeamID
): T.Teams.TeamRoleAndDetails | undefined => {
  const details = map.teams?.[teamID]
  if (!details) {
    return undefined
  }
  return {
    implicitAdmin:
      details.implicitRole === T.RPCGen.TeamRole.admin || details.implicitRole === T.RPCGen.TeamRole.owner,
    role: Teams.teamRoleByEnum[details.role],
  }
}

const annotatedTeamToMeta = (
  teamID: T.Teams.TeamID,
  annotatedTeam: T.RPCGen.AnnotatedTeam,
  roleAndDetails: T.Teams.TeamRoleAndDetails | undefined
): T.Teams.TeamMeta => ({
  allowPromote: annotatedTeam.showcase.anyMemberShowcase,
  id: teamID,
  isMember: (roleAndDetails?.role ?? 'none') !== 'none',
  isOpen: !!annotatedTeam.settings.open,
  memberCount: annotatedTeam.members?.length ?? 0,
  role: roleAndDetails?.role ?? 'none',
  showcasing: annotatedTeam.showcase.isShowcased,
  teamname: annotatedTeam.name,
})

// forceLocalCache: a disabled "shadow" instance (one that returns the context
// value instead of its own) must NOT share the loader's cache map. With enabled=false
// useCachedResource resets the cache (loadedAt=0), which would clobber the loader's
// loaded data. Give shadows a private throwaway map so their resets are harmless.
const useLoadedTeamCacheMap = (forceLocalCache: boolean) => {
  const [localCacheMap] = React.useState<LoadedTeamCacheMap>(() => new Map())
  return forceLocalCache ? localCacheMap : loadedTeamCache
}

const useLoadedTeamRaw = (
  teamID: T.Teams.TeamID,
  enabled = true,
  subscribeToUpdates = enabled,
  forceLocalCache = false
): LoadedTeam => {
  const validTeamID = loadableTeamID(teamID)
  const {loadIfStale: loadRoleMapIfStale, roleMap} = useTeamsRoleMap()
  // a disabled instance resets whatever cache it holds, so it must never hold the
  // shared one - gate on exactly the load condition, not just forceLocalCache
  const cacheMap = useLoadedTeamCacheMap(forceLocalCache || !enabled || !validTeamID)
  const cache = React.useMemo(
    () => getCachedResourceCache(cacheMap, emptyLoadedTeamData(validTeamID), validTeamID),
    [cacheMap, validTeamID]
  )
  // Seed from the teams-list cache so the header (teamname, avatar, member count)
  // renders immediately instead of waiting for getAnnotatedTeam to round-trip.
  // key the memo on this team's meta, not on the map: the map gets a new
  // identity on every teams-list reload, and a fresh initialData object churns
  // the whole useCachedResource state/effect chain for no reason
  const teamsListMap = useTeamsListMap()
  const listMeta = validTeamID ? teamsListMap.get(validTeamID) : undefined
  const initialData = React.useMemo(() => {
    const data = emptyLoadedTeamData(validTeamID)
    return listMeta ? {...data, teamMeta: listMeta} : data
  }, [validTeamID, listMeta])
  const {data, loaded, loading, reload, clear} = useCachedResource({
    cache,
    cacheKey: validTeamID,
    enabled: enabled && !!validTeamID,
    initialData,
    load: async () => {
      const teamIDToLoad = validTeamID ?? T.Teams.noTeamID
      const [annotatedTeam] = await Promise.all([
        T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID: teamIDToLoad}),
        loadRoleMapIfStale(),
      ])
      return {
        teamDetails: Teams.annotatedTeamToDetails(annotatedTeam),
        teamMeta: annotatedTeamToMeta(teamIDToLoad, annotatedTeam, undefined),
      }
    },
    onError: error => {
      logger.warn(`Failed to load team data for ${validTeamID}`, error)
    },
    staleMs: loadedTeamReloadStaleMs,
  })
  // builds a fresh object whenever the team is in the map, so without this the
  // memos below (and the context value built from them) never hit and every
  // consumer re-renders on every render of the provider
  const roleAndDetails = React.useMemo(
    () => roleAndDetailsFromMap(roleMap, validTeamID ?? T.Teams.noTeamID),
    [roleMap, validTeamID]
  )
  const teamMeta = React.useMemo(
    () => ({
      ...data.teamMeta,
      isMember: (roleAndDetails?.role ?? 'none') !== 'none',
      role: roleAndDetails?.role ?? 'none',
    }),
    [data.teamMeta, roleAndDetails]
  )
  const yourOperations = React.useMemo(() => Teams.deriveCanPerform(roleAndDetails), [roleAndDetails])

  // One logical change fires metadata, role map and changedByID, and a reconnect
  // fires all three at once - measured as 4 getAnnotatedTeam for one team inside
  // 116ms, each a separate event superseding the last. Coalesce them the way
  // useReloadOnTeamChanges does for the teams list: leading so the common single
  // notification still reloads immediately, trailing to catch the rest of a burst.
  const reloadNow = React.useEffectEvent(() => {
    if (enabled) {
      void reload()
    }
  })
  const [debouncedReload] = React.useState<DebouncedFunc<() => void>>(() =>
    debounce(() => reloadNow(), 2000, {leading: true, trailing: true})
  )
  React.useEffect(() => {
    return () => {
      debouncedReload.cancel()
    }
  }, [debouncedReload])
  const onTeamChange = () => {
    debouncedReload()
  }
  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', onTeamChange, subscribeToUpdates)
  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', onTeamChange, subscribeToUpdates)
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (action.payload.params.teamID === validTeamID) {
      onTeamChange()
    }
  }, subscribeToUpdates)
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clear(validTeamID)
    }
  }, subscribeToUpdates)
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clear(validTeamID)
    }
  }, subscribeToUpdates)

  const teamDetails = data.teamDetails
  return React.useMemo(
    () => ({loaded, loading, reload, teamDetails, teamMeta, yourOperations}),
    [loaded, loading, reload, teamDetails, teamMeta, yourOperations]
  )
}

export const LoadedTeamProvider = (props: React.PropsWithChildren<{teamID: T.Teams.TeamID}>) => {
  const {children, teamID} = props
  const loadedTeam = useLoadedTeamRaw(teamID)
  const value = React.useMemo(() => ({...loadedTeam, teamID}), [loadedTeam, teamID])
  return <LoadedTeamContext.Provider value={value}>{children}</LoadedTeamContext.Provider>
}

export const useLoadedTeam = (teamID: T.Teams.TeamID, enabled = true): LoadedTeam => {
  const context = React.useContext(LoadedTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamRaw(
    teamID,
    enabled && !useContextValue,
    enabled && !useContextValue,
    useContextValue
  )
  return useContextValue ? context : raw
}
