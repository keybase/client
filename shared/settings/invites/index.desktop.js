// @flow
import React, {Component} from 'react'
import moment from 'moment'

import {intersperseFn} from '../../util/arrays'
import {Avatar, Banner, Box, Button, Divider, Icon, Input, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, desktopStyles} from '../../styles'
import {stateColors} from '../../util/tracker'
import SubHeading from '../subheading'
import * as Types from '../../constants/types/settings'
import type {Props} from './index'

type State = {
  inviteEmail: string,
  inviteMessage: string,
  showMessageField: boolean,
}

class Invites extends Component<Props, State> {
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
        {!!this.props.error && <Banner color="red" text={this.props.error.message} />}
        <Box
          style={{...globalStyles.flexBoxColumn, flex: 1, overflow: 'auto', padding: globalMargins.medium}}
        >
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              alignItems: 'center',
              marginTop: globalMargins.small,
              minHeight: 269,
            }}
          >
            <Input
              hintText="Friend's email (optional)"
              value={this.state.inviteEmail}
              onChangeText={inviteEmail => this._handleChangeEmail(inviteEmail)}
              style={{marginBottom: 0}}
            />
            {this.state.showMessageField && (
              <Input
                hintText="Message (optional)"
                multiline={true}
                value={this.state.inviteMessage}
                onChangeText={inviteMessage => this.setState({inviteMessage})}
              />
            )}
            <Button
              type="Primary"
              label="Generate invitation"
              onClick={() => this._invite()}
              waiting={props.waitingForResponse}
              style={{alignSelf: 'center', marginTop: globalMargins.medium}}
            />
          </Box>
          {props.pendingInvites.length > 0 && (
            <Box style={{...globalStyles.flexBoxColumn, flexShrink: 0, marginBottom: 16}}>
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
            </Box>
          )}
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
  return intersperseFn(i => <Divider key={i} />, arr)
}

function PendingInviteItem({
  invite,
  onReclaimInvitation,
  onSelectPendingInvite,
}: {
  invite: Types.PendingInvite,
  onReclaimInvitation: (id: string) => void,
  onSelectPendingInvite: (invite: Types.PendingInvite) => void,
}) {
  return (
    <Box style={styleInviteItem}>
      {invite.email ? (
        <PendingEmailContent invite={invite} onSelectPendingInvite={onSelectPendingInvite} />
      ) : (
        <PendingURLContent invite={invite} />
      )}
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
  invite: Types.PendingInvite,
  onSelectPendingInvite: (invite: Types.PendingInvite) => void,
}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Avatar size={32} />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold" onClick={() => onSelectPendingInvite(invite)}>
          {invite.email}
        </Text>
        <Text type="BodySmall">Invited {moment.unix(invite.created).format('MMM D, YYYY')}</Text>
      </Box>
    </Box>
  )
}

function PendingURLContent({invite}: {invite: Types.PendingInvite}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Icon
        type="iconfont-link"
        style={{
          marginRight: globalMargins.tiny,
          marginTop: 3,
        }}
        color={globalColors.black_20}
        fontSize={13}
      />
      <Text type="Body" selectable={true} style={{color: globalColors.blue}}>
        {invite.url}
      </Text>
    </Box>
  )
}

function AcceptedInviteItem({
  invite,
  onClick,
}: {
  invite: Types.AcceptedInvite,
  onClick: (username: string) => void,
}) {
  const nameColor = stateColors(invite.currentlyFollowing, invite.trackerState, globalColors.blue).username
  return (
    <Box style={{...styleInviteItem, ...desktopStyles.clickable, flexShrink: 0}} onClick={onClick}>
      <Avatar username={invite.username} size={32} />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold" style={{color: nameColor}}>
          {invite.username}
        </Text>
        <Text type="BodySmall">{invite.fullname}</Text>
      </Box>
    </Box>
  )
}

const styleInviteItem = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 40,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

export default Invites
