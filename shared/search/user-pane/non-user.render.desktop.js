// @flow
import React, {Component} from 'react'
import {Avatar, Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import {capitalize} from 'lodash'
import {platformToLogo24} from '../../constants/search'
import {AVATAR_SIZE, HEADER_TOP_SPACE, HEADER_SIZE} from '../../profile/index.desktop'
import type {Props} from './non-user.render'

import electron from 'electron'
const shell = electron.shell || electron.remote.shell

function InviteSection ({inviteLink, outOfInvites, onSendInvite, username, serviceName}: {inviteLink: ?string, outOfInvites: ?boolean, onSendInvite: () => void, username: string, serviceName: string}) {
  let textRef

  if (outOfInvites) {
    return (
      <Box style={stylesLinkContainer}>
        <Text type='Body' style={{textAlign: 'center'}}>Since you're out of invites, {`${username}@${serviceName}`} will need to request a signup on Keybase.io. Encourage them to join.</Text>
      </Box>
    )
  }

  if (inviteLink) {
    return (
      <Box style={stylesLinkContainer}>
        <Text type='Body' style={{textAlign: 'center'}}>You can send {`${username}@${serviceName}`} this link to skip the invitation queue:</Text>
        <Box style={stylesLinkBox}>
          <Icon style={{color: globalColors.black_10}} type='iconfont-link' onClick={() => textRef && textRef.highlightText()} />
          <Text allowHighlightText={true} ref={r => { textRef = r }} style={stylesLink} type='BodyPrimaryLink'>{inviteLink}</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box style={styleInviteLink} onClick={onSendInvite}>
      <Icon type='icon-invite-link-16' />
      <Text type='BodyPrimaryLink' style={styleInviteLinkText}>Send invite link</Text>
    </Box>
  )
}

export default class NonUserRender extends Component<void, Props, void> {
  _onClickAvatar () {
    shell.openExternal(this.props.profileUrl)
  }

  render () {
    return (
      <Box style={styleContainer}>
        <Box style={{...styleHeader, backgroundColor: globalColors.blue}} />
        <Box style={styleBioBlurb}>
          <Avatar
            style={globalStyles.clickable}
            onClick={() => this._onClickAvatar()}
            url={this.props.avatar}
            size={AVATAR_SIZE}
          />
          <Box style={styleUsernameRow} onClick={() => this._onClickAvatar()}>
            <Icon type={platformToLogo24(this.props.serviceName)} />
            <Text type='HeaderBig' style={styleUsername}>
              {this.props.username}
            </Text>
          </Box>
          {this.props.fullname && <Text type='BodySemibold' style={styleFullname}>{this.props.fullname}</Text>}
          <Text type='BodySmall' style={styleServiceLabel}>{this.props.serviceName} user</Text>
        </Box>
        <Text type='BodySmall' style={styleDetails}>When {this.props.username} connects Keybase and their {capitalize(this.props.serviceName)} account, your computer will verify them and rekey the folder or conversation.</Text>
        <InviteSection {...this.props} />
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  width: 320,
  height: '100%',
}

const styleHeader = {
  position: 'absolute',
  width: '100%',
  height: HEADER_SIZE,
}

const styleBioBlurb = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'flex-start',
  marginTop: HEADER_TOP_SPACE,
}

const styleUsernameRow = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  marginTop: globalMargins.tiny,
}

const styleUsername = {
  ...globalStyles.selectable,
  marginLeft: globalMargins.xtiny,
}

const styleFullname = {
  ...globalStyles.selectable,
  color: globalColors.black_75,
  marginTop: 2,
}

const styleServiceLabel = {
  fontSize: 11,
  lineHeight: '14px',
  textTransform: 'uppercase',
  marginTop: globalMargins.xtiny,
}

const styleDetails = {
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
  marginBottom: 42,
  textAlign: 'center',
}

const styleInviteLink = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: globalMargins.medium,
}

const styleInviteLinkText = {
  color: globalColors.blue,
  marginLeft: globalMargins.tiny,
}

const stylesLinkBox = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'stretch',
  marginTop: 8,
  borderRadius: 48,
  borderStyle: 'solid',
  height: 32,
  backgroundColor: globalColors.white,
  borderColor: globalColors.black_10,
  borderWidth: 1,
}

const stylesLink = {
  ...globalStyles.selectable,
  marginLeft: 7,
  color: globalColors.green2,
}

const stylesLinkContainer = {
  ...globalStyles.flexBoxColumn,
  cursor: 'default',
  alignItems: 'center',
  position: 'relative',
  padding: 16,
}
