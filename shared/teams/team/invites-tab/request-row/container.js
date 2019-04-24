// @flow
import * as React from 'react'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Types from '../../../../constants/types/teams'
import {getDisabledReasonsForRolePicker} from '../../../../constants/teams'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {sendNotificationFooter} from '../../../role-picker'
import {TeamRequestRow, type RowProps} from '.'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {connect} from '../../../../util/container'

type OwnProps = {
  username: string,
  teamname: string,
}

const mapStateToProps = (state, {username, teamname}) => ({
  disabledReasonsForRolePicker: getDisabledReasonsForRolePicker(state, teamname, username),
})

const mapDispatchToProps = (dispatch, {username, teamname}) => ({
  letIn: (sendNotification: boolean, role: Types.TeamRoleType) => {
    dispatch(
      TeamsGen.createAddToTeam({
        role,
        sendChatNotification: sendNotification,
        teamname,
        username,
      })
    )
  },
  onChat: () => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'teamInvite'}))
  },
  onIgnoreRequest: () => dispatch(TeamsGen.createIgnoreRequest({teamname, username})),
  onOpenProfile: () => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  return {
    disabledReasonsForRolePicker: stateProps.disabledReasonsForRolePicker,
    letIn: dispatchProps.letIn,
    onChat: dispatchProps.onChat,
    onIgnoreRequest: dispatchProps.onIgnoreRequest,
    onOpenProfile: dispatchProps.onOpenProfile,
    teamname: ownProps.teamname,
    username: ownProps.username,
  }
}

type State = {
  rolePickerOpen: boolean,
  selectedRole: Types.TeamRoleType,
  sendNotification: boolean,
}

type LetIn = {
  letIn: (sendNotification: boolean, role: Types.TeamRoleType) => void,
}

class RequestRowStateWrapper extends React.Component<RowProps & LetIn, State> {
  state = {
    rolePickerOpen: false,
    selectedRole: 'writer',
    sendNotification: false,
  }
  _setRef = false

  render() {
    const {letIn, ...rest} = this.props
    return (
      <TeamRequestRow
        {...rest}
        onAccept={() => this.setState({rolePickerOpen: true})}
        isRolePickerOpen={this.state.rolePickerOpen}
        onCancelRolePicker={() => this.setState({rolePickerOpen: false})}
        onEditMembership={() => this.setState({rolePickerOpen: true})}
        footerComponent={sendNotificationFooter(this.state.sendNotification, nextVal =>
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

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(RequestRowStateWrapper)
