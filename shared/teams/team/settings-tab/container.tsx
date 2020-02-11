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
      isBigTeam: Constants.isBigTeam(state, teamMeta.teamname),
      openTeam: settings.open,
      // Cast to TeamRoleType
      openTeamRole: teamDetails.settings.openJoinAs,
      publicityAnyMember,
      publicityMember,
      publicityTeam,
      teamID,
      teamname: teamMeta.teamname,
      waitingForSavePublicity: anyWaiting(
        state,
        Constants.teamWaitingKeyByID(teamID, state),
        Constants.retentionWaitingKey(teamID),
        Constants.settingsWaitingKey(teamID)
      ),
      welcomeMessage,
      yourOperations: Constants.getCanPerformByID(state, teamID),
    }
  },
  (dispatch, {teamID}: OwnProps) => ({
    _loadWelcomeMessage: () => dispatch(TeamsGen.createLoadWelcomeMessage({teamID})),
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
    savePublicity: (settings: Types.PublicitySettings) =>
      dispatch(TeamsGen.createSetPublicity({settings, teamID})),
    saveRetentionPolicy: (policy: RetentionPolicy) =>
      dispatch(TeamsGen.createSaveTeamRetentionPolicy({policy, teamID})),
  }),
  (stateProps, dispatchProps) => {
    return {
      ...stateProps,
      loadWelcomeMessage: dispatchProps._loadWelcomeMessage,
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
    }
  }
)(Settings)
