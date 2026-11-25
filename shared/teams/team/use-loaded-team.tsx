import * as T from '@/constants/types'
import logger from '@/logger'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import {useTeamsListMap, useTeamsRoleMap} from '../use-teams-list'
import {subscribeTeamChanged, teamGone, teamReloadDebounceMs} from '../use-team-changed'
import {forgetLoad, refreshLoad, reviveLoad, useLoadData} from '@/query'

type LoadedTeam = {
  loaded: boolean
  loading: boolean
  reload: () => Promise<void>
  // whether teamMeta.showcasing is known: only the teams list carries it, and it can be missing
  // that team (still loading, a deep link, a failed load)
  showcasingKnown: boolean
  teamDetails: T.Teams.TeamDetails
  teamMeta: T.Teams.TeamMeta
  yourOperations: T.Teams.TeamOperations
}

type LoadedTeamContextValue = LoadedTeam & {
  teamID: T.Teams.TeamID
}

// showcasing is added from the teams list (useLoadedTeamRaw), never loaded with the team
type LoadedTeamData = {teamDetails: T.Teams.TeamDetails; teamMeta: Omit<T.Teams.TeamMeta, 'showcasing'>}

export const LoadedTeamContext = React.createContext<LoadedTeamContextValue | null>(null)
const loadedTeamReloadStaleMs = 5_000

// One cache entry per team for every consumer: the team screen, the channel screen and any
// modal above them would otherwise each pay a full team load.
const loadedTeamLoad = 'teams.loadedTeam'

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

// Module scope, not per hook, so a change while no page is mounted still marks the cached copy
// stale; a team whose page was never loaded has no entry, so nothing happens for it. memberCount
// is left out: the page
// counts the members it loads, and that load is what sets the cached count the notice is about.
subscribeTeamChanged('loaded-team', (kinds, teamID) => {
  const key = loadableTeamID(teamID)
  if (!key) {
    return
  }
  if (teamGone(kinds)) {
    forgetLoad(loadedTeamLoad, key)
  } else if (kinds.membership) {
    // Only membership brings back a team left and rejoined: the role map's roles notice for a
    // team just left must not reload it.
    reviveLoad(loadedTeamLoad, key, teamReloadDebounceMs)
  } else if (kinds.roles || kinds.renamed || kinds.settings) {
    refreshLoad(loadedTeamLoad, key, teamReloadDebounceMs)
  }
})

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
): LoadedTeamData['teamMeta'] => ({
  allowPromote: annotatedTeam.showcase.anyMemberShowcase,
  id: teamID,
  isMember: (roleAndDetails?.role ?? 'none') !== 'none',
  isOpen: !!annotatedTeam.settings.open,
  memberCount: annotatedTeam.members?.length ?? 0,
  role: roleAndDetails?.role ?? 'none',
  teamname: annotatedTeam.name,
})

const useLoadedTeamRaw = (
  teamID: T.Teams.TeamID,
  enabled = true
): LoadedTeam => {
  const validTeamID = loadableTeamID(teamID)
  const teamIDToLoad = validTeamID ?? T.Teams.noTeamID
  const {loadIfStale: loadRoleMapIfStale, roleMap} = useTeamsRoleMap()
  // Until the team loads, show what the teams list knows of it so the header
  // (teamname, avatar, member count) renders immediately instead of waiting for
  // getAnnotatedTeam to round-trip.
  const teamsListMap = useTeamsListMap()
  const listMeta = validTeamID ? teamsListMap.get(validTeamID) : undefined
  const seeded = React.useMemo(() => {
    const data = emptyLoadedTeamData(validTeamID)
    return listMeta ? {...data, teamMeta: listMeta} : data
  }, [validTeamID, listMeta])
  const {
    data = seeded,
    loaded,
    loading,
    reloadAndWait: reload,
  } = useLoadData(
    loadedTeamLoad,
    teamIDToLoad,
    async (signal): Promise<LoadedTeamData> => {
      const [annotatedTeam] = await Promise.all([
        T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID: teamIDToLoad}, undefined, signal),
        loadRoleMapIfStale(),
      ])
      return {
        teamDetails: Teams.annotatedTeamToDetails(annotatedTeam),
        teamMeta: annotatedTeamToMeta(teamIDToLoad, annotatedTeam, undefined),
      }
    },
    {
      enabled: enabled && !!validTeamID,
      onError: error => logger.warn(`Failed to load team data for ${teamIDToLoad}`, error),
      staleMs: loadedTeamReloadStaleMs,
    }
  )
  // builds a fresh object whenever the team is in the map, so without this the
  // memos below (and the context value built from them) never hit and every
  // consumer re-renders on every render of the provider
  const roleAndDetails = React.useMemo(
    () => roleAndDetailsFromMap(roleMap, validTeamID ?? T.Teams.noTeamID),
    [roleMap, validTeamID]
  )
  // the annotated team carries the team's own publicity, not your showcase of it, so showcasing
  // comes from the teams list alone; false (and showcasingKnown false) while the list lacks the team
  const showcasingKnown = !!listMeta
  const listShowcasing = listMeta?.showcasing ?? false
  const teamMeta = React.useMemo(
    (): T.Teams.TeamMeta => ({
      ...data.teamMeta,
      isMember: (roleAndDetails?.role ?? 'none') !== 'none',
      role: roleAndDetails?.role ?? 'none',
      showcasing: listShowcasing,
    }),
    [data.teamMeta, roleAndDetails, listShowcasing]
  )
  const yourOperations = React.useMemo(() => Teams.deriveCanPerform(roleAndDetails), [roleAndDetails])


  const teamDetails = data.teamDetails
  return React.useMemo(
    () => ({loaded, loading, reload, showcasingKnown, teamDetails, teamMeta, yourOperations}),
    [loaded, loading, reload, showcasingKnown, teamDetails, teamMeta, yourOperations]
  )
}

export const LoadedTeamProvider = (props: React.PropsWithChildren<{teamID: T.Teams.TeamID}>) => {
  const {children, teamID} = props
  const loadedTeam = useLoadedTeamRaw(teamID)
  const value = React.useMemo(() => ({...loadedTeam, teamID}), [loadedTeam, teamID])
  return <LoadedTeamContext value={value}>{children}</LoadedTeamContext>
}

export const useLoadedTeam = (teamID: T.Teams.TeamID, enabled = true): LoadedTeam => {
  const context = React.useContext(LoadedTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamRaw(teamID, enabled && !useContextValue)
  return useContextValue ? context : raw
}
