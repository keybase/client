import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import {RetentionPolicy} from '../../../constants/types/retention-policy'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Container from '../../../util/container'
import {Settings} from '.'
import {anyWaiting} from '../../../constants/waiting'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

export type OwnProps = {
  teamID: Types.TeamID
}

export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const teamMeta = Constants.getTeamMeta(state, teamID)
    const teamDetails = Constants.getTeamDetails(state, teamID)
    const publicityAnyMember = teamMeta.allowPromote
    const publicityMember = teamMeta.showcasing
    const publicityTeam = teamDetails.settings.teamShowcased
    const settings = teamDetails.settings || Constants.initialTeamSettings
    const welcomeMessage = Constants.getTeamWelcomeMessageByID(state, teamID)
    return {
      canShowcase: teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner',
      error: state.teams.errorInSettings,
      ignoreAccessRequests: teamDetails.settings.tarsDisabled,
      isBigTeam: Constants.isBigTeam(state, teamID),
      openTeam: settings.open,
      // Cast to TeamRoleType
      openTeamRole: teamDetails.settings.openJoinAs,
      publicityAnyMember,
      publicityMember,
      publicityTeam,
      teamID,
      teamname: teamMeta.teamname,
      waitingForWelcomeMessage: anyWaiting(state, Constants.loadWelcomeMessageWaitingKey(teamID)),
      welcomeMessage: welcomeMessage || undefined,
      yourOperations: Constants.getCanPerformByID(state, teamID),
    }
  },
  (dispatch, {teamID}: OwnProps) => ({
    _showRetentionWarning: (
      policy: RetentionPolicy,
      onConfirm: () => void,
      entityType: 'big team' | 'small team'
    ) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {entityType, onConfirm, policy}, selected: 'retentionWarning'}],
        })
      ),
    clearError: () => dispatch(TeamsGen.createSettingsError({error: ''})),
    loadWelcomeMessage: () => dispatch(TeamsGen.createLoadWelcomeMessage({teamID})),
    onEditWelcomeMessage: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'teamEditWelcomeMessage'}]})
      )
    },
    savePublicity: (settings: Types.PublicitySettings) =>
      dispatch(TeamsGen.createSetPublicity({settings, teamID})),
    saveRetentionPolicy: (policy: RetentionPolicy) =>
      dispatch(TeamsGen.createSaveTeamRetentionPolicy({policy, teamID})),
    showOpenTeamWarning: (isOpenTeam: boolean, onConfirm: () => void, teamname: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {isOpenTeam, onConfirm, teamname}, selected: 'openTeamWarning'}],
        })
      ),
  }),
  (stateProps, dispatchProps) => {
    return {
      ...stateProps,
      loadWelcomeMessage: dispatchProps.loadWelcomeMessage,
      onEditWelcomeMessage: dispatchProps.onEditWelcomeMessage,
      savePublicity: (
        settings: Types.PublicitySettings,
        showRetentionWarning: boolean,
        policy: RetentionPolicy | null
      ) => {
        if (policy && stateProps.yourOperations.setRetentionPolicy) {
          showRetentionWarning &&
            dispatchProps._showRetentionWarning(
              policy,
              () => dispatchProps.saveRetentionPolicy(policy),
              stateProps.isBigTeam ? 'big team' : 'small team'
            )
          !showRetentionWarning && dispatchProps.saveRetentionPolicy(policy)
        }
        dispatchProps.savePublicity(settings)
        dispatchProps.clearError()
      },
      showOpenTeamWarning: dispatchProps.showOpenTeamWarning,
    }
  }
)(Settings)
