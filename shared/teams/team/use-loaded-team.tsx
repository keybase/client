import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import {useTeamsRoleMap} from '../use-teams-list'
import {type CachedResourceCache, getCachedResourceCache, useCachedResource} from '../use-cached-resource'

type LoadedTeam = {
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
const loadedTeamCache = new Map<
  T.Teams.TeamID | undefined,
  CachedResourceCache<LoadedTeamData, T.Teams.TeamID | undefined>
>()

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

const useLoadedTeamRaw = (teamID: T.Teams.TeamID, enabled = true): LoadedTeam => {
  const validTeamID = loadableTeamID(teamID)
  const {loadIfStale: loadRoleMapIfStale, roleMap} = useTeamsRoleMap()
  const cache = React.useMemo(
    () => getCachedResourceCache(loadedTeamCache, emptyLoadedTeamData(validTeamID), validTeamID),
    [validTeamID]
  )
  const initialData = React.useMemo(() => emptyLoadedTeamData(validTeamID), [validTeamID])
  const {data, loading, reload, clear} = useCachedResource({
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
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', () => {
    if (enabled) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clear(validTeamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clear(validTeamID)
    }
  })

  return {...data, loading, reload, teamMeta, yourOperations}
}

export const LoadedTeamProvider = (props: React.PropsWithChildren<{teamID: T.Teams.TeamID}>) => {
  const {children, teamID} = props
  const loadedTeam = useLoadedTeamRaw(teamID)
  const value = {...loadedTeam, teamID}
  return <LoadedTeamContext.Provider value={value}>{children}</LoadedTeamContext.Provider>
}

export const useLoadedTeam = (teamID: T.Teams.TeamID, enabled = true): LoadedTeam => {
  const context = React.useContext(LoadedTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamRaw(teamID, enabled && !useContextValue)
  return useContextValue ? context : raw
}
