/* @flow */

import React, {Component} from 'react'
import {Text, Avatar} from '../common-adapters'
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
            <Text type='BodySmall' style={stylesFollowing}>
              <span className='hover-underline' onClick={() => shared.onClickFollowers(username)}>
                <Text type='BodySmall' style={{...globalStyles.fontBold}}>{userInfo.followersCount}</Text> {userInfo.followersCount === 1 ? 'Tracker' : 'Trackers'}
              </span>
              &nbsp;
              &middot;
              &nbsp;
              <span className='hover-underline' onClick={() => shared.onClickFollowing(username)}>
                Tracking <Text type='BodySmall' style={{...globalStyles.fontBold}}>{userInfo.followingCount}</Text>
              </span>
            </Text>
            {userInfo.bio &&
              <Text type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'} style={{...stylesBio, ...stylesBioType[this.props.type]}} lineClamp={userInfo.location ? 2 : 3}>
                {userInfo.bio}
              </Text>
            }
            {userInfo.location &&
              <Text type='BodySmall' style={stylesLocation} lineClamp={1}>{userInfo.location}</Text>
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
const stylesFollowing = {
  ...globalStyles.clickable,
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
