// @flow
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import {type TypedState, connect} from '../../../util/container'
import {Settings} from '.'
import {anyWaiting} from '../../../constants/waiting'
import {navigateAppend} from '../../../actions/route-tree'

export type OwnProps = {
  teamname: string,
}

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => {
  const publicityAnyMember = state.teams.getIn(
    ['teamNameToPublicitySettings', teamname, 'anyMemberShowcase'],
    false
  )
  const publicityMember = state.teams.getIn(['teamNameToPublicitySettings', teamname, 'member'], false)
  const publicityTeam = state.teams.getIn(['teamNameToPublicitySettings', teamname, 'team'], false)
  return {
    isBigTeam: Constants.isBigTeam(state, teamname),
    ignoreAccessRequests: state.teams.getIn(
      ['teamNameToPublicitySettings', teamname, 'ignoreAccessRequests'],
      false
    ),
    openTeam: state.teams.getIn(['teamNameToSettings', teamname, 'open'], false),
    openTeamRole: Constants.teamRoleByEnum[state.teams.getIn(['teamNameToSettings', teamname, 'joinAs'], 1)],
    publicityAnyMember,
    publicityMember,
    publicityTeam,
    waitingForSavePublicity: anyWaiting(state, `setPublicity:${teamname}`, `getDetails:${teamname}`),
    yourOperations: Constants.getCanPerform(state, teamname),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _savePublicity: (teamname: Types.Teamname, settings: Types.PublicitySettings) =>
    dispatch(TeamsGen.createSetPublicity({teamname, settings})),
  _saveRetentionPolicy: (teamname: Types.Teamname, policy: Types.RetentionPolicy) =>
    dispatch(TeamsGen.createSaveTeamRetentionPolicy({teamname, policy})),
  _showRetentionWarning: (days: number, onConfirm: () => void, entityType: 'big team' | 'small team') =>
    dispatch(navigateAppend([{selected: 'retentionWarning', props: {days, onConfirm, entityType}}])),
  setOpenTeamRole: (newOpenTeamRole: Types.TeamRoleType, setNewOpenTeamRole: Types.TeamRoleType => void) => {
    dispatch(
      navigateAppend([
        {
          props: {
            onComplete: setNewOpenTeamRole,
            selectedRole: newOpenTeamRole,
            allowOwner: false,
            allowAdmin: false,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  return {
    ...stateProps,
    ...ownProps,
    savePublicity: (settings, showRetentionWarning: boolean, policy: Types.RetentionPolicy) => {
      if (stateProps.yourOperations.setRetentionPolicy) {
        showRetentionWarning &&
          dispatchProps._showRetentionWarning(
            policy.days,
            () => dispatchProps._saveRetentionPolicy(ownProps.teamname, policy),
            stateProps.isBigTeam ? 'big team' : 'small team'
          )
        !showRetentionWarning && dispatchProps._saveRetentionPolicy(ownProps.teamname, policy)
      }
      dispatchProps._savePublicity(ownProps.teamname, settings)
    },
    setOpenTeamRole: dispatchProps.setOpenTeamRole,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Settings)
