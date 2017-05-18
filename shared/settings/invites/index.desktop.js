// @flow
import React, {Component} from 'react'
import moment from 'moment'

import {intersperseFn} from '../../util/arrays'
import {Avatar, Banner, Box, Button, Divider, Icon, Input, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {stateColors} from '../../util/tracker'
import SubHeading from '../subheading'

import type {Props, PendingInvite, AcceptedInvite} from './index'

type State = {
  inviteEmail: string,
  inviteMessage: string,
  showMessageField: boolean,
}

class Invites extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      inviteEmail: props.inviteEmail,
      inviteMessage: props.inviteMessage,
      showMessageField: props.showMessageField,
    }
  }
  componentWillUnmount() {
    if (this.props.error) this.props.onClearError()
  }

  _handleChangeEmail(inviteEmail: string) {
    const showMessageField = this.state.showMessageField || inviteEmail.length > 0
    this.setState({
      inviteEmail,
      showMessageField,
    })
    if (this.props.error) this.props.onClearError()
  }

  _invite() {
    this.props.onGenerateInvitation(this.state.inviteEmail, this.state.inviteMessage)
  }

  render() {
    const props = this.props
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Banner error={this.props.error} />
        <Box
          style={{...globalStyles.flexBoxColumn, padding: globalMargins.medium, flex: 1, overflow: 'auto'}}
        >
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              minHeight: 269,
              alignItems: 'center',
              marginTop: globalMargins.small,
            }}
          >
            <Input
              hintText="Friend's email (optional)"
              value={this.state.inviteEmail}
              onChangeText={inviteEmail => this._handleChangeEmail(inviteEmail)}
              style={{marginBottom: 0}}
            />
            {this.state.showMessageField &&
              <Input
                hintText="Message (optional)"
                multiline={true}
                value={this.state.inviteMessage}
                onChangeText={inviteMessage => this.setState({inviteMessage})}
              />}
            <Button
              type="Primary"
              label="Generate invitation"
              onClick={() => this._invite()}
              waiting={props.waitingForResponse}
              style={{alignSelf: 'center', marginTop: globalMargins.medium}}
            />
          </Box>
          {props.pendingInvites.length > 0 &&
            <Box style={{...globalStyles.flexBoxColumn, marginBottom: 16, flexShrink: 0}}>
              <SubHeading>Pending invites ({props.pendingInvites.length})</SubHeading>
              {intersperseDividers(
                props.pendingInvites.map(invite => (
                  <PendingInviteItem
                    invite={invite}
                    key={invite.id}
                    onReclaimInvitation={id => props.onReclaimInvitation(id)}
                    onSelectPendingInvite={invite => props.onSelectPendingInvite(invite)}
                  />
                ))
              )}
            </Box>}
          <Box style={{...globalStyles.flexBoxColumn, flexShrink: 0}}>
            <SubHeading>Accepted invites ({props.acceptedInvites.length})</SubHeading>
            {intersperseDividers(
              props.acceptedInvites.map(invite => (
                <AcceptedInviteItem
                  key={invite.id}
                  invite={invite}
                  onClick={() => props.onSelectUser(invite.username)}
                />
              ))
            )}
          </Box>
        </Box>
      </Box>
    )
  }
}

function intersperseDividers(arr) {
  return intersperseFn(i => <Divider key={i} style={{backgroundColor: globalColors.black_05}} />, arr)
}

function PendingInviteItem({
  invite,
  onReclaimInvitation,
  onSelectPendingInvite,
}: {
  invite: PendingInvite,
  onReclaimInvitation: (id: string) => void,
  onSelectPendingInvite: (invite: PendingInvite) => void,
}) {
  return (
    <Box style={styleInviteItem}>
      {invite.email
        ? <PendingEmailContent invite={invite} onSelectPendingInvite={onSelectPendingInvite} />
        : <PendingURLContent invite={invite} />}
      <Box style={{flex: 1}} />
      <Text
        type="BodyPrimaryLink"
        onClick={() => onReclaimInvitation(invite.id)}
        style={{color: globalColors.red}}
      >
        Reclaim
      </Text>
    </Box>
  )
}

function PendingEmailContent({
  invite,
  onSelectPendingInvite,
}: {
  invite: PendingInvite,
  onSelectPendingInvite: (invite: PendingInvite) => void,
}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Avatar url={null} size={32} />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold" onClick={() => onSelectPendingInvite(invite)}>
          {invite.email}
        </Text>
        <Text type="BodySmall">
          Invited {moment.unix(invite.created).format('MMM D, YYYY')}
        </Text>
      </Box>
    </Box>
  )
}

function PendingURLContent({invite}: {invite: PendingInvite}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Icon
        type="iconfont-link"
        style={{
          fontSize: '13px',
          color: globalColors.black_20,
          marginRight: globalMargins.tiny,
          marginTop: 3,
        }}
      />
      <Text type="Body" style={{...globalStyles.selectable, color: globalColors.blue}}>{invite.url}</Text>
    </Box>
  )
}

function AcceptedInviteItem({
  invite,
  onClick,
}: {
  invite: AcceptedInvite,
  onClick: (username: string) => void,
}) {
  const nameColor = stateColors(invite.currentlyFollowing, invite.trackerState, globalColors.blue).username
  return (
    <Box style={{...styleInviteItem, ...globalStyles.clickable, flexShrink: 0}} onClick={onClick}>
      <Avatar username={invite.username} size={32} />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold" style={{color: nameColor}}>
          {invite.username}
        </Text>
        <Text type="BodySmall">
          {invite.fullname}
        </Text>
      </Box>
    </Box>
  )
}

const styleInviteItem = {
  ...globalStyles.flexBoxRow,
  height: 40,
  alignItems: 'center',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  flexShrink: 0,
}

export default Invites
