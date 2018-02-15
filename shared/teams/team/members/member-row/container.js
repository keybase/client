// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../../constants/types/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
import {TeamMemberRow} from '.'
import {amIFollowing} from '../../../../constants/selectors'
import {navigateAppend} from '../../../../actions/route-tree'
import {connect, type TypedState} from '../../../../util/container'

type OwnProps = {
  active: boolean,
  fullName: string,
  username: string,
  teamname: string,
}

type StateProps = {
  following: boolean,
  active: boolean,
  you: ?string,
  _members: I.Set<Types.MemberInfo>,
  youCanManageMembers: boolean,
}

const mapStateToProps = (
  state: TypedState,
  {active, fullName, teamname, username}: OwnProps
): StateProps => ({
  _members: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
  active,
  following: amIFollowing(state, username),
  fullName: state.config.username === username ? 'You' : fullName,
  you: state.config.username,
  youCanManageMembers: state.entities.getIn(
    ['teams', 'teamNameToCanPerform', teamname, 'manageMembers'],
    false
  ),
})

type DispatchProps = {
  onClick: () => void,
  _onReAddToTeam: (teamname: string, username: string, role: ?Types.TeamRoleType) => void,
  _onRemoveFromTeam: (teamname: string, username: string) => void,
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps): DispatchProps => ({
  onClick: () =>
    dispatch(
      navigateAppend([
        {
          selected: 'member',
          props: ownProps,
        },
      ])
    ),
  _onReAddToTeam: (teamname: string, username: string, role: ?Types.TeamRoleType) => {
    dispatch(
      TeamsGen.createAddToTeam({
        teamname,
        username,
        role: role || 'reader',
        sendChatNotification: false,
        email: '',
      })
    )
  },
  _onRemoveFromTeam: (teamname: string, username: string) => {
    dispatch(
      TeamsGen.createRemoveMemberOrPendingInvite({
        username,
        teamname,
        email: '',
        inviteID: '',
      })
    )
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  const user =
    stateProps._members && stateProps._members.find(member => member.username === ownProps.username)
  const type = user ? user.type : null
  return {
    ...ownProps,
    ...stateProps,
    type,
    onClick: dispatchProps.onClick,
    onReAddToTeam: () => dispatchProps._onReAddToTeam(ownProps.teamname, ownProps.username, type),
    onRemoveFromTeam: () => dispatchProps._onRemoveFromTeam(ownProps.teamname, ownProps.username),
  }
}

const ConnectedMemberRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMemberRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedMemberRow key={props.username} {...props} />
}
