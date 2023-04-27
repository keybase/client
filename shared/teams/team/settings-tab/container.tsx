import * as Constants from '../../../constants/teams'
import type * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import {Settings} from '.'
import {anyWaiting} from '../../../constants/waiting'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {useSettingsState} from './use-settings'

export type OwnProps = {
  teamID: Types.TeamID
}

export default (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamMeta = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const teamDetails = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const publicityAnyMember = teamMeta.allowPromote
  const publicityMember = teamMeta.showcasing
  const publicityTeam = teamDetails.settings.teamShowcased
  const settings = teamDetails.settings || Constants.initialTeamSettings
  const welcomeMessage =
    Container.useSelector(state => Constants.getTeamWelcomeMessageByID(state, teamID)) ?? undefined
  const canShowcase = teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner'
  const error = Container.useSelector(state => state.teams.errorInSettings)
  const ignoreAccessRequests = teamDetails.settings.tarsDisabled
  const isBigTeam = Container.useSelector(state => Constants.isBigTeam(state, teamID))
  const openTeam = settings.open
  const openTeamRole = teamDetails.settings.openJoinAs
  const teamname = teamMeta.teamname
  const waitingForWelcomeMessage = Container.useSelector(state =>
    anyWaiting(state, Constants.loadWelcomeMessageWaitingKey(teamID))
  )
  const yourOperations = Container.useSelector(state => Constants.getCanPerformByID(state, teamID))
  const dispatch = Container.useDispatch()
  const clearError = () => {
    dispatch(TeamsGen.createSettingsError({error: ''}))
  }
  const loadWelcomeMessage = () => {
    dispatch(TeamsGen.createLoadWelcomeMessage({teamID}))
  }
  const onEditWelcomeMessage = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamEditWelcomeMessage'}]})
    )
  }
  const savePublicity = (settings: Types.PublicitySettings) => {
    dispatch(TeamsGen.createSetPublicity({settings, teamID}))
  }
  const showOpenTeamWarning = (isOpenTeam: boolean, teamname: string) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {isOpenTeam, teamname}, selected: 'openTeamWarning'}],
      })
    )
  }
  const allowOpenTrigger = useSettingsState(state => state.allowOpenTrigger)

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
