import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as Teams from '@/constants/teams'
import * as React from 'react'
import {useTeamsAnnotatedTeam, useTeamsRoleMap} from '../use-teams-list'

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

type LoadedTeamState = Omit<LoadedTeam, 'reload'> & {
  loadedTeamID?: T.Teams.TeamID
}

const LoadedTeamContext = React.createContext<LoadedTeamContextValue | null>(null)

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamState = (teamID?: T.Teams.TeamID): LoadedTeamState => ({
  loadedTeamID: teamID,
  loading: false,
  teamDetails: Teams.emptyTeamDetails,
  teamMeta: teamID ? Teams.makeTeamMeta({id: teamID}) : Teams.emptyTeamMeta,
  yourOperations: Teams.initialCanUserPerform,
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
  const {loadIfStale: loadAnnotatedTeamIfStale, reload: reloadAnnotatedTeam} = useTeamsAnnotatedTeam()
  const {loadIfStale: loadRoleMapIfStale, roleMap} = useTeamsRoleMap()
  const [state, setState] = React.useState<LoadedTeamState>(() => emptyLoadedTeamState(validTeamID))
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(
    (nextTeamID?: T.Teams.TeamID) => {
      requestVersionRef.current++
      setState(emptyLoadedTeamState(nextTeamID))
    },
    [setState]
  )

  const load = React.useCallback(async (force: boolean) => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true}))
    try {
      const [annotatedTeam] = await Promise.all([
        force ? reloadAnnotatedTeam(validTeamID) : loadAnnotatedTeamIfStale(validTeamID),
        loadRoleMapIfStale(),
      ])
      if (!annotatedTeam) {
        throw new Error(`No annotated team returned for ${validTeamID}`)
      }
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      setState({
        loadedTeamID: validTeamID,
        loading: false,
        teamDetails: Teams.annotatedTeamToDetails(annotatedTeam),
        teamMeta: annotatedTeamToMeta(validTeamID, annotatedTeam, undefined),
        yourOperations: Teams.initialCanUserPerform,
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load team data for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false}))
    }
  }, [clearState, enabled, loadAnnotatedTeamIfStale, loadRoleMapIfStale, reloadAnnotatedTeam, validTeamID])

  const reload = React.useCallback(async () => {
    await load(true)
  }, [load])

  const loadIfStale = React.useCallback(async () => {
    await load(false)
  }, [load])

  const visibleState =
    enabled && state.loadedTeamID !== validTeamID ? emptyLoadedTeamState(validTeamID) : state
  const roleAndDetails = roleAndDetailsFromMap(roleMap, validTeamID ?? T.Teams.noTeamID)
  const teamMeta = React.useMemo(
    () => ({
      ...visibleState.teamMeta,
      isMember: (roleAndDetails?.role ?? 'none') !== 'none',
      role: roleAndDetails?.role ?? 'none',
    }),
    [roleAndDetails, visibleState.teamMeta]
  )
  const yourOperations = React.useMemo(() => Teams.deriveCanPerform(roleAndDetails), [roleAndDetails])

  React.useEffect(() => {
    void loadIfStale()
  }, [loadIfStale])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      void loadIfStale()
    }, [loadIfStale])
  )

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
      clearState(validTeamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clearState(validTeamID)
    }
  })

  return {...visibleState, reload, teamMeta, yourOperations}
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
