import * as React from 'react'
import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Types from '../../../../../constants/types/teams'
import * as Constants from '../../../../../constants/teams'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import {sendNotificationFooter} from '../../../../role-picker'
import {TeamRequestRow, RowProps} from '.'
import {createShowUserProfile} from '../../../../../actions/profile-gen'
import {connect} from '../../../../../util/container'

type OwnProps = {
  ctime: number
  fullName: string
  username: string
  teamID: Types.TeamID
}

type State = {
  rolePickerOpen: boolean
  selectedRole: Types.TeamRoleType
  sendNotification: boolean
}

type ExtraProps = {
  _notifLabel: string
  letIn: (sendNotification: boolean, role: Types.TeamRoleType) => void
}

class RequestRowStateWrapper extends React.Component<RowProps & ExtraProps, State> {
  state = {
    rolePickerOpen: false,
    selectedRole: 'writer' as 'writer',
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
        footerComponent={sendNotificationFooter(_notifLabel, this.state.sendNotification, nextVal =>
          this.setState({sendNotification: nextVal})
        )}
        onConfirmRolePicker={role => {
          this.setState({rolePickerOpen: false})
          letIn(this.state.sendNotification, role)
        }}
        onSelectRole={selectedRole => this.setState({selectedRole})}
        selectedRole={this.state.selectedRole}
      />
    )
  }
}

export default connect(
  (state, {fullName, username, teamID}: OwnProps) => {
    const {teamname} = Constants.getTeamMeta(state, teamID)

    return {
      _notifLabel:
        Constants.getTeamType(state, teamname) === 'big'
          ? `Announce them in #general`
          : `Announce them in team chat`,
      disabledReasonsForRolePicker: Constants.getDisabledReasonsForRolePicker(state, teamID, username),
      fullName, // MemberRow has a special case for "You" but it's impossible to see your join req
      teamname,
    }
  },
  (dispatch, {username, teamID}) => ({
    _onIgnoreRequest: (teamname: string) => dispatch(TeamsGen.createIgnoreRequest({teamname, username})),
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
      fullName: stateProps.fullName,
      letIn: dispatchProps.letIn,
      onChat: dispatchProps.onChat,
      onIgnoreRequest: () => dispatchProps._onIgnoreRequest(stateProps.teamname),
      onOpenProfile: dispatchProps.onOpenProfile,
      teamname: stateProps.teamname,
      username: ownProps.username,
    }
  }
)(RequestRowStateWrapper)
