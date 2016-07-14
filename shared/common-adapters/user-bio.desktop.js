/* @flow */

import React, {Component} from 'react'
import {Text, Avatar, Box} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import * as shared from './user-bio.shared'

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

    let [bioLineClamp, locationLineClamp] = [{}, {}]
    if (this.props.type === 'Tracker') {
      bioLineClamp = {lineClamp: userInfo.location ? 2 : 3}
      locationLineClamp = {lineClamp: 1}
    }

    return (
      <div style={this.props.style}>
        <div style={stylesContainer}>
          <Avatar
            onClick={() => shared.onClickAvatar(username)}
            style={{...globalStyles.clickable, zIndex: 2}}
            url={userInfo.avatar}
            size={avatarSize}
            following={currentlyFollowing}
            followsYou={followsYou} />
          <div style={stylesContent}>
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
            <Box style={{...globalStyles.flexBoxRow}}>
              <Text type='BodySmallSecondaryLink' style={{...globalStyles.fontBold}}
                onClick={() => shared.onClickFollowers(username)}>{userInfo.followersCount}
                <Text type='BodySmallSecondaryLink'>&nbsp;Tracker{userInfo.followersCount === 1 ? '' : 's'}</Text>
              </Text>
              <Text type='BodySmall'>&nbsp; &middot; &nbsp;</Text>
              <Text type='BodySmallSecondaryLink' onClick={() => shared.onClickFollowing(username)}>Tracking&nbsp;
                <Text type='BodySmallSecondaryLink' style={{...globalStyles.fontBold}}>{userInfo.followingCount}</Text>
              </Text>
            </Box>
            {userInfo.bio &&
              <Text type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'} style={{...stylesBio, ...stylesBioType[this.props.type]}} {...bioLineClamp}>
                {userInfo.bio}
              </Text>
            }
            {userInfo.location &&
              <Text type='BodySmall' style={stylesLocation} {...locationLineClamp}>{userInfo.location}</Text>
            }
          </div>
        </div>
      </div>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 320,
}
const stylesContent = {
  backgroundColor: globalColors.white,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 320,
  marginTop: -35,
  paddingTop: 35,
  zIndex: 1,
}
const stylesUsername = {
  ...globalStyles.selectable,
  marginTop: 7,
}
const stylesFullname = {
  ...globalStyles.selectable,
  textAlign: 'center',
  color: globalColors.black_75,
}
const stylesFollowLabel = {
  fontSize: 11,
  textTransform: 'uppercase',
}
const stylesBio = {
  ...globalStyles.selectable,
  paddingLeft: 30,
  paddingRight: 30,
  textAlign: 'center',
}
const stylesBioType = {
  Profile: {
    marginTop: globalMargins.tiny,
  },
  Tracker: {},
}
const stylesLocation = {
  ...globalStyles.selectable,
  paddingLeft: 30,
  paddingRight: 30,
  textAlign: 'center',
}
