import * as C from '../../../constants'
import * as Constants from '../../../constants/teams'
import * as ChatConstants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import type * as Types from '../../../constants/types/teams'
import {Settings} from '.'
import {useSettingsState} from './use-settings'

export type OwnProps = {
  teamID: Types.TeamID
}

export default (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamMeta = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID)) ?? Constants.emptyTeamDetails
  const publicityAnyMember = teamMeta.allowPromote
  const publicityMember = teamMeta.showcasing
  const publicityTeam = teamDetails.settings.teamShowcased
  const settings = teamDetails.settings || Constants.initialTeamSettings
  const welcomeMessage = C.useTeamsState(s => s.teamIDToWelcomeMessage.get(teamID))
  const canShowcase = teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner'
  const error = C.useTeamsState(s => s.errorInSettings)
  const ignoreAccessRequests = teamDetails.settings.tarsDisabled
  const isBigTeam = C.useChatState(s => ChatConstants.isBigTeam(s, teamID))
  const openTeam = settings.open
  const openTeamRole = teamDetails.settings.openJoinAs
  const teamname = teamMeta.teamname
  const waitingForWelcomeMessage = Container.useAnyWaiting(Constants.loadWelcomeMessageWaitingKey(teamID))
  const yourOperations = C.useTeamsState(s => Constants.getCanPerformByID(s, teamID))
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
  const savePublicity = (settings: Types.PublicitySettings) => {
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
    savePublicity: (settings: Types.PublicitySettings) => {
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
