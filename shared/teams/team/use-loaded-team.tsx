import * as T from '@/constants/types'
import logger from '@/logger'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import {useTeamsListMap, useTeamsRoleMap} from '../use-teams-list'
import type * as EngineGen from '@/constants/rpc'
import {
  type CachedResourceInvalidation,
  createCachedResourceNamespace,
  useCachedResource,
} from '@/util/use-cached-resource'

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

const LoadedTeamContext = React.createContext<LoadedTeamContextValue | null>(null)
const loadedTeamReloadStaleMs = 5_000

// One logical change fires metadata, role map and changedByID, and a reconnect
// fires all three at once - measured as 4 getAnnotatedTeam for one team inside
// 116ms. useCachedResource coalesces them onto one reload.
const teamInvalidations = (teamID?: T.Teams.TeamID) =>
  [
    {type: 'keybase.1.NotifyTeam.teamMetadataUpdate'},
    {type: 'keybase.1.NotifyTeam.teamRoleMapChanged'},
    {
      type: 'keybase.1.NotifyTeam.teamChangedByID',
      when: (action: EngineGen.Actions) =>
        (action as EngineGen.ActionOf<'keybase.1.NotifyTeam.teamChangedByID'>).payload.params.teamID ===
        teamID,
    },
    {
      effect: 'clear',
      type: 'keybase.1.NotifyTeam.teamDeleted',
      when: (action: EngineGen.Actions) =>
        (action as EngineGen.ActionOf<'keybase.1.NotifyTeam.teamDeleted'>).payload.params.teamID === teamID,
    },
    {
      effect: 'clear',
      type: 'keybase.1.NotifyTeam.teamExit',
      when: (action: EngineGen.Actions) =>
        (action as EngineGen.ActionOf<'keybase.1.NotifyTeam.teamExit'>).payload.params.teamID === teamID,
    },
  ] satisfies ReadonlyArray<CachedResourceInvalidation>

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamData = (teamID?: T.Teams.TeamID): LoadedTeamData => ({
  teamDetails: Teams.emptyTeamDetails,
  teamMeta: teamID ? Teams.makeTeamMeta({id: teamID}) : Teams.emptyTeamMeta,
})

// One entry per team, shared by every consumer: the stale window and the
// single-flight live on the entry, so consumers holding separate ones cannot see
// each other's in-flight request. While each provider and each provider-less
// consumer held its own map, 81% of getAnnotatedTeam calls in an e2e run landed
// inside their own 5s stale window - the team screen, the channel screen and any
// modal above them each paid a full 200ms team load.
const loadedTeams = createCachedResourceNamespace<LoadedTeamData, T.Teams.TeamID>(
  'loaded-team-cache',
  emptyLoadedTeamData
)

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

const useLoadedTeamRaw = (teamID: T.Teams.TeamID, enabled = true): LoadedTeam => {
  const validTeamID = loadableTeamID(teamID)
  const {loadIfStale: loadRoleMapIfStale, roleMap} = useTeamsRoleMap()
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
  const {data, loaded, loading, reload} = useCachedResource({
    cacheKey: validTeamID,
    enabled,
    initialData,
    invalidateOn: teamInvalidations(validTeamID),
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
    namespace: loadedTeams,
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
  const raw = useLoadedTeamRaw(teamID, enabled && !useContextValue)
  return useContextValue ? context : raw
}
