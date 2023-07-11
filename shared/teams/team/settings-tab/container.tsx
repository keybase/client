import * as Constants from '../../../constants/teams'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import type * as Types from '../../../constants/types/teams'
import {Settings} from '.'
import {useSettingsState} from './use-settings'

export type OwnProps = {
  teamID: Types.TeamID
}

export default (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamMeta = Constants.useState(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Constants.useState(s => s.teamDetails.get(teamID)) ?? Constants.emptyTeamDetails
  const publicityAnyMember = teamMeta.allowPromote
  const publicityMember = teamMeta.showcasing
  const publicityTeam = teamDetails.settings.teamShowcased
  const settings = teamDetails.settings || Constants.initialTeamSettings
  const welcomeMessage = Constants.useState(s => s.teamIDToWelcomeMessage.get(teamID))
  const canShowcase = teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner'
  const error = Constants.useState(s => s.errorInSettings)
  const ignoreAccessRequests = teamDetails.settings.tarsDisabled
  const isBigTeam = Container.useSelector(state => Constants.isBigTeam(state, teamID))
  const openTeam = settings.open
  const openTeamRole = teamDetails.settings.openJoinAs
  const teamname = teamMeta.teamname
  const waitingForWelcomeMessage = Container.useAnyWaiting(Constants.loadWelcomeMessageWaitingKey(teamID))
  const yourOperations = Constants.useState(s => Constants.getCanPerformByID(s, teamID))
  const dispatch = Container.useDispatch()

  const _loadWelcomeMessage = Constants.useState(s => s.dispatch.loadWelcomeMessage)
  const resetErrorInSettings = Constants.useState(s => s.dispatch.resetErrorInSettings)
  const setPublicity = Constants.useState(s => s.dispatch.setPublicity)
  const clearError = resetErrorInSettings
  const loadWelcomeMessage = () => {
    _loadWelcomeMessage(teamID)
  }
  const onEditWelcomeMessage = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamEditWelcomeMessage'}]})
    )
  }
  const savePublicity = (settings: Types.PublicitySettings) => {
    setPublicity(teamID, settings)
  }
  const showOpenTeamWarning = (isOpenTeam: boolean, teamname: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {isOpenTeam, teamname}, selected: 'openTeamWarning'}],
      })
    )
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
