import * as C from '../../../../../constants'
import * as Constants from '../../../../../constants/teams'
import * as ChatConstants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as React from 'react'
import type * as Types from '../../../../../constants/types/teams'
import type {RowProps} from '.'
import {TeamRequestRow} from '.'
import {sendNotificationFooter} from '../../../../role-picker'

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

export default (ownProps: OwnProps) => {
  const {teamID, username, reset, fullName} = ownProps
  const {teamname} = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  const _notifLabel = ChatConstants.useState(s =>
    ChatConstants.isBigTeam(s, teamID) ? `Announce them in #general` : `Announce them in team chat`
  )
  const disabledReasonsForRolePicker = C.useTeamsState(s =>
    Constants.getDisabledReasonsForRolePicker(s, teamID, username)
  )
  const waiting = Container.useAnyWaiting(Constants.addMemberWaitingKey(teamID, username))
  const removeMember = C.useTeamsState(s => s.dispatch.removeMember)
  const ignoreRequest = C.useTeamsState(s => s.dispatch.ignoreRequest)

  const _onIgnoreRequest = (teamname: string) => {
    if (reset) {
      removeMember(teamID, username)
    } else {
      ignoreRequest(teamID, teamname, username)
    }
  }

  const addToTeam = C.useTeamsState(s => s.dispatch.addToTeam)
  const letIn = (sendNotification: boolean, role: Types.TeamRoleType) => {
    addToTeam(teamID, [{assertion: username, role}], sendNotification)
  }
  const previewConversation = ChatConstants.useState(s => s.dispatch.previewConversation)
  const onChat = () => {
    username && previewConversation({participants: [username], reason: 'teamInvite'})
  }
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const onOpenProfile = () => {
    showUserProfile(username)
  }
  const props = {
    _notifLabel: _notifLabel,
    ctime: ownProps.ctime,
    disabledReasonsForRolePicker: disabledReasonsForRolePicker,
    firstItem: ownProps.firstItem,
    fullName: fullName,
    letIn: letIn,
    onChat: onChat,
    onIgnoreRequest: () => _onIgnoreRequest(teamname),
    onOpenProfile: onOpenProfile,
    reset: ownProps.reset,
    teamID: ownProps.teamID,
    username: ownProps.username,
    waiting: waiting,
  }
  return <RequestRowStateWrapper {...props} />
}
