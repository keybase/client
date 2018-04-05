// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {TeamMemberRow} from '.'
import {amIFollowing} from '../../../../constants/selectors'
import {navigateAppend} from '../../../../actions/route-tree'
import {connect, type TypedState} from '../../../../util/container'
import * as TrackerGen from '../../../../actions/tracker-gen'

import type {MemberRow as OwnProps} from '../../row-types'
export type {OwnProps}

type StateProps = {
  following: boolean,
  active: boolean,
  you: ?string,
  youCanManageMembers: boolean,
}

const mapStateToProps = (
  state: TypedState,
  {active, fullName, teamname, username}: OwnProps
): StateProps => ({
  active,
  following: amIFollowing(state, username),
  fullName: state.config.username === username ? 'You' : fullName,
  you: state.config.username,
  youCanManageMembers: state.teams.getIn(['teamNameToCanPerform', teamname, 'manageMembers'], false),
})

type DispatchProps = {
  _onChat: () => void,
  onClick: () => void,
  _onReAddToTeam: (teamname: string, username: string, role: ?Types.TeamRoleType) => void,
  _onRemoveFromTeam: (teamname: string, username: string) => void,
  _onShowTracker: (username: string) => void,
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps): DispatchProps => ({
  _onChat: () => {
    ownProps.username && dispatch(Chat2Gen.createStartConversation({participants: [ownProps.username]}))
  },
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
  _onShowTracker: (username: string) => {
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username}))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    ...ownProps,
    ...stateProps,
    onChat: () => dispatchProps._onChat(),
    onClick: dispatchProps.onClick,
    onReAddToTeam: () =>
      dispatchProps._onReAddToTeam(ownProps.teamname, ownProps.username, ownProps.roleType),
    onRemoveFromTeam: () => dispatchProps._onRemoveFromTeam(ownProps.teamname, ownProps.username),
    onShowTracker: () => dispatchProps._onShowTracker(ownProps.username),
  }
}

const ConnectedMemberRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMemberRow)

export default function(i: number, props: OwnProps) {
  // $FlowIssue I have no idea but everything works
  return <ConnectedMemberRow {...props} />
}
