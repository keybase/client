import * as React from 'react'
import * as TeamsGen from '../../../../../actions/teams-gen'
import type * as Types from '../../../../../constants/types/teams'
import * as Constants from '../../../../../constants/teams'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Container from '../../../../../util/container'
import {sendNotificationFooter} from '../../../../role-picker'
import type {RowProps} from '.'
import {TeamRequestRow} from '.'
import {createShowUserProfile} from '../../../../../actions/profile-gen'

type OwnProps = {
  ctime: number
  firstItem: boolean
  fullName: string
  username: string
  reset?: boolean
  teamID: Types.TeamID
}

type State = {
  rolePickerOpen: boolean
  sendNotification: boolean
}

type ExtraProps = {
  _notifLabel: string
  letIn: (sendNotification: boolean, role: Types.TeamRoleType) => void
}

class RequestRowStateWrapper extends React.Component<RowProps & ExtraProps, State> {
  state = {
    rolePickerOpen: false,
    sendNotification: true,
  }
  _setRef = false

  render() {
    const {_notifLabel, letIn, ...rest} = this.props
    return (
      <TeamRequestRow
        {...rest}
        onAccept={() => this.setState({rolePickerOpen: true})}
        isRolePickerOpen={this.state.rolePickerOpen}
        onCancelRolePicker={() => this.setState({rolePickerOpen: false})}
        onEditMembership={() => this.setState({rolePickerOpen: true})}
        footerComponent={
          this.props.reset
            ? undefined
            : sendNotificationFooter(_notifLabel, this.state.sendNotification, nextVal =>
                this.setState({sendNotification: nextVal})
              )
        }
        onConfirmRolePicker={role => {
          this.setState({rolePickerOpen: false})
          letIn(!this.props.reset && this.state.sendNotification, role)
        }}
      />
    )
  }
}

export default Container.connect(
  (state, {fullName, username, teamID}: OwnProps) => {
    const {teamname} = Constants.getTeamMeta(state, teamID)

    return {
      _notifLabel: Constants.isBigTeam(state, teamID)
        ? `Announce them in #general`
        : `Announce them in team chat`,
      disabledReasonsForRolePicker: Constants.getDisabledReasonsForRolePicker(state, teamID, username),
      fullName, // MemberRow has a special case for "You" but it's impossible to see your join req
      teamname,
      waiting: Container.anyWaiting(state, Constants.addMemberWaitingKey(teamID, username)),
    }
  },
  (dispatch, {reset, username, teamID}) => ({
    _onIgnoreRequest: (teamname: string) =>
      reset
        ? dispatch(TeamsGen.createRemoveMember({teamID, username}))
        : dispatch(TeamsGen.createIgnoreRequest({teamID, teamname, username})),
    letIn: (sendNotification: boolean, role: Types.TeamRoleType) => {
      dispatch(
        TeamsGen.createAddToTeam({
          sendChatNotification: sendNotification,
          teamID,
          users: [{assertion: username, role}],
        })
      )
    },
    onChat: () => {
      username &&
        dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'teamInvite'}))
    },
    onOpenProfile: () => dispatch(createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    return {
      _notifLabel: stateProps._notifLabel,
      ctime: ownProps.ctime,
      disabledReasonsForRolePicker: stateProps.disabledReasonsForRolePicker,
      firstItem: ownProps.firstItem,
      fullName: stateProps.fullName,
      letIn: dispatchProps.letIn,
      onChat: dispatchProps.onChat,
      onIgnoreRequest: () => dispatchProps._onIgnoreRequest(stateProps.teamname),
      onOpenProfile: dispatchProps.onOpenProfile,
      reset: ownProps.reset,
      teamID: ownProps.teamID,
      username: ownProps.username,
      waiting: stateProps.waiting,
    }
  }
)(RequestRowStateWrapper)
