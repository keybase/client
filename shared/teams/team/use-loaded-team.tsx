import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as Teams from '@/constants/teams'
import * as React from 'react'

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
  const [state, setState] = React.useState<LoadedTeamState>(() => emptyLoadedTeamState(validTeamID))
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(
    (nextTeamID?: T.Teams.TeamID) => {
      requestVersionRef.current++
      setState(emptyLoadedTeamState(nextTeamID))
    },
    [setState]
  )

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true}))
    try {
      const [annotatedTeam, roleMap] = await Promise.all([
        T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID: validTeamID}),
        T.RPCGen.teamsGetTeamRoleMapRpcPromise(),
      ])
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      const roleAndDetails = roleAndDetailsFromMap(roleMap, validTeamID)
      setState({
        loadedTeamID: validTeamID,
        loading: false,
        teamDetails: Teams.annotatedTeamToDetails(annotatedTeam),
        teamMeta: annotatedTeamToMeta(validTeamID, annotatedTeam, roleAndDetails),
        yourOperations: Teams.deriveCanPerform(roleAndDetails),
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load team data for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false}))
    }
  }, [clearState, enabled, validTeamID])

  const visibleState =
    enabled && state.loadedTeamID !== validTeamID ? emptyLoadedTeamState(validTeamID) : state

  React.useEffect(() => {
    void reload()
  }, [reload])

  C.Router2.useSafeFocusEffect(() => {
    void reload()
  })

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

  return {...visibleState, reload}
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
