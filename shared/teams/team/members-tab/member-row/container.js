// @flow
import * as Types from '../../../../constants/types/teams'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/teams'
import {TeamMemberRow} from '.'
import {amIFollowing} from '../../../../constants/selectors'
import {navigateAppend} from '../../../../actions/route-tree'
import {connect, type TypedState} from '../../../../util/container'
import * as TrackerGen from '../../../../actions/tracker-gen'

import type {MemberRow as OwnProps} from '../../../row-types'

type StateProps = {
  following: boolean,
  active: boolean,
  you: ?string,
  youCanManageMembers: boolean,
}

const blankInfo = Constants.makeMemberInfo()

const mapStateToProps = (state: TypedState, {teamname, username}: OwnProps): StateProps => {
  const map = Constants.getTeamMembers(state, teamname)
  const info = map.get(username, blankInfo)

  return {
    active: info.active,
    following: amIFollowing(state, username),
    fullName: state.config.username === username ? 'You' : info.fullName,
    roleType: info.type,
    username: info.username,
    you: state.config.username,
    youCanManageMembers: Constants.getCanPerform(state, teamname).manageMembers,
  }
}

type DispatchProps = {
  _onChat: () => void,
  onClick: () => void,
  _onReAddToTeam: (teamname: string, username: string, role: Types.TeamRoleType) => void,
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
  _onReAddToTeam: (teamname: string, username: string, role: Types.TeamRoleType) => {
    dispatch(
      TeamsGen.createAddToTeam({
        teamname,
        username,
        role: role,
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
    active: stateProps.active,
    youCanManageMembers: stateProps.youCanManageMembers,
    following: stateProps.following,
    fullName: stateProps.fullName,
    roleType: stateProps.roleType,
    username: stateProps.username,
    you: stateProps.you,
    onChat: () => dispatchProps._onChat(),
    onClick: dispatchProps.onClick,
    onReAddToTeam: () =>
      dispatchProps._onReAddToTeam(ownProps.teamname, ownProps.username, ownProps.roleType),
    onRemoveFromTeam: () => dispatchProps._onRemoveFromTeam(ownProps.teamname, ownProps.username),
    onShowTracker: () => dispatchProps._onShowTracker(ownProps.username),
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMemberRow)
