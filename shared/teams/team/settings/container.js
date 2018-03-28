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

const mapStateToProps = (state: TypedState, {teamname}: OwnProps) => ({
  ignoreAccessRequests: state.entities.getIn(
    ['teams', 'teamNameToPublicitySettings', teamname, 'ignoreAccessRequests'],
    false
  ),
  openTeam: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname, 'open'], false),
  openTeamRole:
    Constants.teamRoleByEnum[
      state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname, 'joinAs'], 1)
    ],
  // $FlowFixMe sort out the team settings / publicity settings types
  publicityAnyMember: state.entities.getIn(
    ['teams', 'teamNameToPublicitySettings', teamname, 'anyMemberShowcase'],
    false
  ),
  // $FlowFixMe same here
  publicityMember: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'member'], false),
  // $FlowFixMe and here
  publicityTeam: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'team'], false),
  waitingForSavePublicity: anyWaiting(state, `setPublicity:${teamname}`, `getDetails:${teamname}`),
  yourOperations: Constants.getCanPerform(state, teamname),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _savePublicity: (teamname: Types.Teamname, settings: Types.PublicitySettings) =>
    dispatch(TeamsGen.createSetPublicity({teamname, settings})),
  _saveRetentionPolicy: (teamname: Types.Teamname, policy: Types.RetentionPolicy) =>
    dispatch(TeamsGen.createSetTeamRetentionPolicy({teamname, policy})),
  _showRetentionWarning: (days: number, onConfirm: () => void) =>
    dispatch(navigateAppend([{selected: 'retentionWarning', props: {days, onConfirm}}])),
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
      showRetentionWarning &&
        dispatchProps._showRetentionWarning(policy.days, () =>
          dispatchProps._saveRetentionPolicy(ownProps.teamname, policy)
        )
      !showRetentionWarning && dispatchProps._saveRetentionPolicy(ownProps.teamname, policy)
      dispatchProps._savePublicity(ownProps.teamname, settings)
    },
    setOpenTeamRole: dispatchProps.setOpenTeamRole,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Settings)
