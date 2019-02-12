// @flow
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import type {RetentionPolicy} from '../../../constants/types/retention-policy'
import * as TeamsGen from '../../../actions/teams-gen'
import {connect} from '../../../util/container'
import {Settings} from '.'
import {anyWaiting} from '../../../constants/waiting'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

export type OwnProps = {
  teamname: string,
}

const mapStateToProps = (state, {teamname}: OwnProps) => {
  const publicitySettings = Constants.getTeamPublicitySettings(state, teamname)
  const publicityAnyMember = publicitySettings.anyMemberShowcase
  const publicityMember = publicitySettings.member
  const publicityTeam = publicitySettings.team
  const settings = Constants.getTeamSettings(state, teamname)
  return {
    ignoreAccessRequests: publicitySettings.ignoreAccessRequests,
    isBigTeam: Constants.isBigTeam(state, teamname),
    openTeam: settings.open,
    // TODO this is really a maybe team rolettype
    openTeamRole: ((Constants.teamRoleByEnum[settings.joinAs]: any): Types.TeamRoleType),
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
  setOpenTeamRole: (newOpenTeamRole: Types.TeamRoleType, setNewOpenTeamRole: Types.TeamRoleType => void) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              allowAdmin: false,
              allowOwner: false,
              onComplete: setNewOpenTeamRole,
              pluralizeRoleName: true,
              selectedRole: newOpenTeamRole,
            },
            selected: 'controlledRolePicker',
          },
        ],
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    ...stateProps,
    savePublicity: (
      settings: Types.PublicitySettings,
      showRetentionWarning: boolean,
      policy: RetentionPolicy
    ) => {
      if (stateProps.yourOperations.setRetentionPolicy) {
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
    setOpenTeamRole: dispatchProps.setOpenTeamRole,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Settings)
