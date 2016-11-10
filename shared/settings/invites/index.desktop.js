// @flow
import React from 'react'
import moment from 'moment'

import {intersperseFn} from '../../util/arrays'
import {Avatar, Box, Button, Divider, Icon, Input, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {stateColors} from '../../util/tracker'
import SubHeading from '../subheading'

import type {Props, PendingInvite, PendingEmailInvite, PendingURLInvite, AcceptedInvite} from './index'

function intersperseDividers (arr) {
  return intersperseFn(i => <Divider key={i} style={{backgroundColor: globalColors.black_05}} />, arr)
}

function Invites (props: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, padding: globalMargins.medium, flexShrink: 0, flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, minHeight: 269, alignItems: 'stretch', marginTop: globalMargins.small}}>
        <Input
          hintText="Friend's email (optional)"
          value={props.inviteEmail}
          onChangeText={props.onChangeInviteEmail}
          errorText={props.emailError ? ' ' : null}
          style={{marginBottom: 0}}
        />
        {props.showMessageField && <Input
          hintText='Message (optional)'
          multiline={true}
          value={props.inviteMessage}
          onChangeText={props.onChangeInviteMessage}
        />}
        <Button
          type='Primary'
          label='Generate invitation'
          onClick={props.onGenerateInvitation}
          waiting={props.waitingForResponse}
          style={{alignSelf: 'center', marginTop: globalMargins.medium}}
        />
      </Box>
      {props.pendingInvites.length > 0 && <Box style={{...globalStyles.flexBoxColumn, marginBottom: 16, flexShrink: 0}}>
        <SubHeading>Pending invites ({props.pendingInvites.length})</SubHeading>
        {intersperseDividers(props.pendingInvites.map(invite =>
          <PendingInviteItem
            key={invite.id}
            invite={invite}
            onReclaim={id => props.onReclaimInvitation(id)}
          />
        ))}
      </Box>}
      <Box style={{...globalStyles.flexBoxColumn, flexShrink: 0}}>
        <SubHeading>Accepted invites ({props.acceptedInvites.length})</SubHeading>
        {intersperseDividers(props.acceptedInvites.map(invite =>
          <AcceptedInviteItem
            key={invite.id}
            invite={invite}
            onClick={() => props.onClickUser(invite.username)}
          />
        ))}
      </Box>
    </Box>
  )
}

function PendingInviteItem ({invite, onReclaim}: {invite: PendingInvite, onReclaim: (id: string) => void}) {
  return (
    <Box style={styleInviteItem}>
      {invite.type === 'pending-email' ? <PendingEmailContent invite={invite} /> : <PendingURLContent invite={invite} />}
      <Box style={{flex: 1}} />
      <Text
        type='BodySmallInlineLink'
        onClick={() => onReclaim(invite.id)}
        style={{color: globalColors.red}}
      >
        Reclaim
      </Text>
    </Box>
  )
}

function PendingEmailContent ({invite}: {invite: PendingEmailInvite}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Avatar
        url={null}
        size={32}
      />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small, marginBottom: itemAlignmentFudge}}>
        <Text
          type='BodySemibold'
        >
          {invite.email}
        </Text>
        <Text
          type='BodySmall'
          style={{lineHeight: '17px'}}
        >
          Invited {moment.unix(invite.created).format('MMM D, YYYY')}
        </Text>
      </Box>
    </Box>
  )
}

function PendingURLContent ({invite}: {invite: PendingURLInvite}) {
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Icon type='iconfont-link' style={{fontSize: '13px', color: globalColors.black_20, marginRight: globalMargins.tiny, marginTop: 3}} />
      <Text type='Body' style={{...globalStyles.selectable, color: globalColors.blue}}>{invite.url}</Text>
    </Box>
  )
}

function AcceptedInviteItem ({invite, onClick}: {invite: AcceptedInvite, onClick: (username: string) => void}) {
  const nameColor = stateColors(invite.currentlyFollowing, invite.trackerState, globalColors.blue).username
  return (
    <Box style={{...styleInviteItem, ...globalStyles.clickable, flexShrink: 0}} onClick={onClick}>
      <Avatar
        username={invite.username}
        size={32}
      />
      <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small, marginBottom: itemAlignmentFudge}}>
        <Text
          type='BodySemibold'
          style={{color: nameColor}}
        >
          {invite.username}
        </Text>
        <Text
          type='BodySmall'
          style={{lineHeight: '17px'}}
        >
          {invite.fullname}
        </Text>
      </Box>
    </Box>
  )
}

const itemAlignmentFudge = 5

const styleInviteItem = {
  ...globalStyles.flexBoxRow,
  height: 48,
  alignItems: 'center',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  flexShrink: 0,
}

export default Invites
