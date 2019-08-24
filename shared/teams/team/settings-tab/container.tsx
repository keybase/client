import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import {RetentionPolicy} from '../../../constants/types/retention-policy'
import * as TeamsGen from '../../../actions/teams-gen'
import {connect} from '../../../util/container'
import {Settings} from '.'
import {anyWaiting} from '../../../constants/waiting'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

export type OwnProps = {
  teamname: string
}

const mapStateToProps = (state, {teamname}: OwnProps) => {
  const publicitySettings = Constants.getTeamPublicitySettings(state, teamname)
  const publicityAnyMember = publicitySettings.anyMemberShowcase
  const publicityMember = publicitySettings.member
  const publicityTeam = publicitySettings.team
  const settings = Constants.getTeamSettings(state, teamname)
  const openTeamRole: Types.MaybeTeamRoleType = Constants.teamRoleByEnum[settings.joinAs] || 'none'
  return {
    ignoreAccessRequests: publicitySettings.ignoreAccessRequests,
    isBigTeam: Constants.isBigTeam(state, teamname),
    openTeam: settings.open,
    // Cast to TeamRoleType
    openTeamRole: openTeamRole === 'none' ? 'reader' : openTeamRole,
    publicityAnyMember,
    publicityMember,
    publicityTeam,
    teamname,
    waitingForSavePublicity: anyWaiting(
      state,
      `team:${teamname}`,
      `teamRetention:${teamname}`,
      `teamSettings:${teamname}`
    ),
    yourOperations: Constants.getCanPerform(state, teamname),
  }
}

const mapDispatchToProps = dispatch => ({
  _savePublicity: (teamname: Types.Teamname, settings: Types.PublicitySettings) =>
    dispatch(TeamsGen.createSetPublicity({settings, teamname})),
  _saveRetentionPolicy: (teamname: Types.Teamname, policy: RetentionPolicy) =>
    dispatch(TeamsGen.createSaveTeamRetentionPolicy({policy, teamname})),
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
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    ...stateProps,
    savePublicity: (
      settings: Types.PublicitySettings,
      showRetentionWarning: boolean,
      policy: RetentionPolicy | null
    ) => {
      if (policy && stateProps.yourOperations.setRetentionPolicy) {
        showRetentionWarning &&
          dispatchProps._showRetentionWarning(
            policy,
            () => dispatchProps._saveRetentionPolicy(stateProps.teamname, policy),
            stateProps.isBigTeam ? 'big team' : 'small team'
          )
        !showRetentionWarning && dispatchProps._saveRetentionPolicy(stateProps.teamname, policy)
      }
      dispatchProps._savePublicity(stateProps.teamname, settings)
    },
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Settings)
