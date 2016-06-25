/* @flow */

import React, {Component} from 'react'

import {Box, Avatar, Text} from './'
import * as shared from './user-bio.shared'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'

import type {Props} from './user-bio'

export default class BioRender extends Component {
  props: Props;

  render () {
    const {avatarSize, username, userInfo, currentlyFollowing} = this.props
    if (!userInfo) {
      return null
    }

    const {followsYou} = userInfo
    const followLabel = shared.followLabel(userInfo, currentlyFollowing)
    const headerColor = shared.headerColor(this.props)

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        <Box style={stylesHeaderBar(avatarSize, headerColor)} />
        <Box style={stylesAvatarWrapper(avatarSize)}>
          <Avatar
            style={stylesAvatar}
            onClick={() => shared.onClickAvatar(username)}
            url={userInfo.avatar}
            size={avatarSize}
            following={currentlyFollowing}
            followsYou={followsYou} />
        </Box>
        <Box style={stylesContent}>
          <Text
            type='HeaderBig'
            style={{...stylesUsername, ...shared.usernameStyle(this.props)}}
            onClick={() => shared.onClickAvatar(username)}>
            {username}
          </Text>
          <Text type='BodySemibold' style={stylesFullname}>{userInfo.fullname}</Text>
          {followLabel &&
            <Text type='BodySmall' style={stylesFollowLabel}>{followLabel}</Text>
          }
          <Text type='BodySmall' style={stylesFollowing}>
            <Text type='BodySmallLink' onClick={() => shared.onClickFollowers(username)} style={stylesFollowingLabel}>
              <Text type='BodySmall' style={stylesFollowingCount}>{userInfo.followersCount}</Text> {userInfo.followersCount === 1 ? 'Tracker' : 'Trackers'}
            </Text>
            &nbsp;
            &middot;
            &nbsp;
            <Text type='BodySmallLink' onClick={() => shared.onClickFollowing(username)} style={stylesFollowingLabel}>
              Tracking <Text type='BodySmall' style={stylesFollowingCount}>{userInfo.followingCount}</Text>
            </Text>
          </Text>
          {userInfo.bio &&
            <Text type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'} style={{...stylesBio}} lineClamp={userInfo.location ? 2 : 3}>
              {userInfo.bio}
            </Text>
          }
          {userInfo.location &&
            <Text type='BodySmall' style={stylesLocation} lineClamp={1}>{userInfo.location}</Text>
          }
        </Box>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
}
const stylesHeaderBar = (avatarSize: number, color: string) => ({
  height: avatarSize / 2,
  backgroundColor: color,
})
const stylesAvatarWrapper = (avatarSize: number) => ({ // eslint-disable-line arrow-parens
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  flex: 1,
  height: avatarSize,
  marginTop: -avatarSize / 2,
})
const stylesAvatar = {
  ...globalStyles.clickable,
}
const stylesContent = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}
const stylesUsername = {
  ...globalStyles.selectable,
  marginTop: globalMargins.tiny,
}
const stylesFullname = {
  ...globalStyles.selectable,
  textAlign: 'center',
  color: globalColors.black_75,
  marginTop: globalMargins.xtiny,
}
const stylesFollowLabel = {
  fontSize: 12,
  textTransform: 'uppercase',
  color: globalColors.black_40,
  marginTop: globalMargins.xtiny,
}
const stylesFollowing = {
  ...globalStyles.clickable,
  color: globalColors.black_40,
  marginTop: globalMargins.xtiny,
}
const stylesFollowingLabel = {
  color: globalColors.black_40,
}
const stylesFollowingCount = {
  color: globalColors.black_40,
  ...globalStyles.fontBold,
}
const stylesBio = {
  ...globalStyles.selectable,
  textAlign: 'center',
  color: globalColors.black_75,
  marginTop: globalMargins.tiny,
}
const stylesLocation = {
  ...globalStyles.selectable,
  textAlign: 'center',
  marginTop: globalMargins.xtiny,
}
