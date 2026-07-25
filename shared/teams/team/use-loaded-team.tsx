import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import {useTeamsListMap, useTeamsRoleMap} from '../use-teams-list'
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '../use-cached-resource'

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
const LoadedTeamCacheContext = React.createContext<LoadedTeamCacheMap | null>(null)
const loadedTeamReloadStaleMs = 5_000

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamData = (teamID?: T.Teams.TeamID): LoadedTeamData => ({
  teamDetails: Teams.emptyTeamDetails,
  teamMeta: teamID ? Teams.makeTeamMeta({id: teamID}) : Teams.emptyTeamMeta,
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
const useLoadedTeamCacheMap = (providedCacheMap?: LoadedTeamCacheMap, forceLocalCache = false) => {
  const contextCacheMap = React.useContext(LoadedTeamCacheContext)
  const [localCacheMap] = React.useState<LoadedTeamCacheMap>(() => new Map())
  if (forceLocalCache) {
    return localCacheMap
  }
  return providedCacheMap ?? contextCacheMap ?? localCacheMap
}

const useLoadedTeamRaw = (
  teamID: T.Teams.TeamID,
  enabled = true,
  providedCacheMap?: LoadedTeamCacheMap,
  subscribeToUpdates = enabled,
  forceLocalCache = false
): LoadedTeam => {
  const validTeamID = loadableTeamID(teamID)
  const {loadIfStale: loadRoleMapIfStale, roleMap} = useTeamsRoleMap()
  const cacheMap = useLoadedTeamCacheMap(providedCacheMap, forceLocalCache)
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
  const roleAndDetails = roleAndDetailsFromMap(roleMap, validTeamID ?? T.Teams.noTeamID)
  const teamMeta = React.useMemo(
    () => ({
      ...data.teamMeta,
      isMember: (roleAndDetails?.role ?? 'none') !== 'none',
      role: roleAndDetails?.role ?? 'none',
    }),
    [data.teamMeta, roleAndDetails]
  )
  const yourOperations = React.useMemo(() => Teams.deriveCanPerform(roleAndDetails), [roleAndDetails])

  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled) {
      void reload()
    }
  }, subscribeToUpdates)
  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', () => {
    if (enabled) {
      void reload()
    }
  }, subscribeToUpdates)
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      void reload()
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
  const [cacheMap] = React.useState<LoadedTeamCacheMap>(() => new Map())
  const loadedTeam = useLoadedTeamRaw(teamID, true, cacheMap)
  const value = React.useMemo(() => ({...loadedTeam, teamID}), [loadedTeam, teamID])
  return (
    <LoadedTeamCacheContext.Provider value={cacheMap}>
      <LoadedTeamContext.Provider value={value}>{children}</LoadedTeamContext.Provider>
    </LoadedTeamCacheContext.Provider>
  )
}

export const useLoadedTeam = (teamID: T.Teams.TeamID, enabled = true): LoadedTeam => {
  const context = React.useContext(LoadedTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamRaw(
    teamID,
    enabled && !useContextValue,
    undefined,
    enabled && !useContextValue,
    useContextValue
  )
  return useContextValue ? context : raw
}
