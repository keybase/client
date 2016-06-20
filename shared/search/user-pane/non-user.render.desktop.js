/* @flow */

import React, {Component} from 'react'
import {Avatar, Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles/style-guide'
import {capitalize} from 'lodash'
import type {Props} from './non-user.render'
import type {Props as IconProps} from '../../common-adapters/icon'

import electron from 'electron'
const shell = electron.shell || electron.remote.shell

export default class Render extends Component<void, Props, void> {
  _onClickAvatar () {
    shell.openExternal(this.props.profileURL)
  }

  _iconNameForService (serviceName: string): IconProps.type {
    return {
      'twitter': 'twitter-logo-24',
      'github': 'github-logo-24',
      'reddit': 'reddit-logo-24',
      'pgp': 'icon-pgp-key-24',
      'coinbase': 'coinbase-logo-24',
    }[serviceName]
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
            size={112}
          />
          <Box style={styleUsernameRow} onClick={() => this._onClickAvatar()}>
            <Icon type={this._iconNameForService(this.props.serviceName)} />
            <Text
              type='HeaderBig'
              style={styleUsername}
            >
              {this.props.username}
            </Text>
          </Box>
          {this.props.fullname && <Text type='BodySemibold' style={styleFullname}>{this.props.fullname}</Text>}
          <Text type='BodySmall' style={styleServiceLabel}>{this.props.serviceName} user</Text>
        </Box>
        <Text type='BodySmall' style={styleDetails}>When {this.props.username} connects Keybase and their {capitalize(this.props.serviceName)} account, your computer will verify them and rekey the folder or conversation.</Text>
        <Box style={styleInviteLink} onClick={this.props.onSendInvite}>
          <Icon type='icon-invite-link-24' />
          <Text type='Body' style={styleInviteLinkText}>Send invite link</Text>
        </Box>
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
  height: 96,
}

const styleBioBlurb = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'flex-start',
  marginTop: 39,
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
  marginBottom: globalMargins.medium,
}

const styleInviteLinkText = {
  color: globalColors.blue,
  marginLeft: globalMargins.tiny,
}
