import * as C from '@/constants'
import type * as T from '@/constants/types'
import {Settings} from '.'
import {useSettingsState} from './use-settings'

export type OwnProps = {
  teamID: T.Teams.TeamID
}

const Container = (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamMeta = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID)) ?? C.Teams.emptyTeamDetails
  const publicityAnyMember = teamMeta.allowPromote
  const publicityMember = teamMeta.showcasing
  const publicityTeam = teamDetails.settings.teamShowcased
  const settings = teamDetails.settings
  const welcomeMessage = C.useTeamsState(s => s.teamIDToWelcomeMessage.get(teamID))
  const canShowcase = teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner'
  const error = C.useTeamsState(s => s.errorInSettings)
  const ignoreAccessRequests = teamDetails.settings.tarsDisabled
  const isBigTeam = C.useChatState(s => C.Chat.isBigTeam(s, teamID))
  const openTeam = settings.open
  const openTeamRole = teamDetails.settings.openJoinAs
  const teamname = teamMeta.teamname
  const waitingForWelcomeMessage = C.Waiting.useAnyWaiting(C.Teams.loadWelcomeMessageWaitingKey(teamID))
  const yourOperations = C.useTeamsState(s => C.Teams.getCanPerformByID(s, teamID))
  const _loadWelcomeMessage = C.useTeamsState(s => s.dispatch.loadWelcomeMessage)
  const resetErrorInSettings = C.useTeamsState(s => s.dispatch.resetErrorInSettings)
  const setPublicity = C.useTeamsState(s => s.dispatch.setPublicity)
  const clearError = resetErrorInSettings
  const loadWelcomeMessage = () => {
    _loadWelcomeMessage(teamID)
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onEditWelcomeMessage = () => {
    navigateAppend({props: {teamID}, selected: 'teamEditWelcomeMessage'})
  }
  const savePublicity = (settings: T.Teams.PublicitySettings) => {
    setPublicity(teamID, settings)
  }
  const showOpenTeamWarning = (isOpenTeam: boolean, teamname: string) => {
    navigateAppend({props: {isOpenTeam, teamname}, selected: 'openTeamWarning'})
  }
  const allowOpenTrigger = useSettingsState(s => s.allowOpenTrigger)

  const props = {
    allowOpenTrigger,
    canShowcase,
    clearError,
    error,
    ignoreAccessRequests,
    isBigTeam,
    loadWelcomeMessage,
    onEditWelcomeMessage,
    openTeam,
    openTeamRole,
    publicityAnyMember,
    publicityMember,
    publicityTeam,
    savePublicity: (settings: T.Teams.PublicitySettings) => {
      savePublicity(settings)
      clearError()
    },
    showOpenTeamWarning,
    teamID,
    teamname,
    waitingForWelcomeMessage,
    welcomeMessage,
    yourOperations,
  }
  return <Settings {...props} />
}

export default Container
