/* @flow */

import React, {Component} from 'react'
import {Text, Avatar} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import electron from 'electron'

const shell = electron.shell || electron.remote.shell
const avatarSize = 80

import type {BioProps} from './bio.render'

export default class BioRender extends Component {
  props: BioProps;

  _onClickAvatar () {
    shell.openExternal(`https://keybase.io/${this.props.username}`)
  }

  _onClickFollowers () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  _onClickFollowing () {
    shell.openExternal(`https://keybase.io/${this.props.username}#profile-tracking-section`)
  }

  _followLabel (): ?string {
    const {userInfo, currentlyFollowing} = this.props
    if (!userInfo) {
      return null
    }

    if (userInfo.followsYou && currentlyFollowing) {
      return 'You track each other'
    } else if (userInfo.followsYou) {
      return 'Tracks you'
    }

    return null
  }

  render () {
    const {username, userInfo, currentlyFollowing} = this.props
    if (!userInfo) {
      return null
    }

    const followsYou = userInfo.followsYou
    const followLabel = this._followLabel()

    return (
      <div style={stylesOuter}>
        <div style={stylesContainer}>
          <div style={stylesAvatarOuter}>
            <Avatar onClick={() => this._onClickAvatar()} style={globalStyles.clickable} url={userInfo.avatar} size={avatarSize} />
            {(followsYou || currentlyFollowing) &&
              <div>
                {followsYou && <div style={followBadgeStyles.followsYou}> <div style={{...followBadgeCommon, height: 6, width: 6, top: 2, right: 2}} /></div>}
                <div style={currentlyFollowing ? followBadgeStyles.following : followBadgeStyles.notFollowing} />
              </div>
            }
          </div>
          <div style={stylesContent}>
            <Text
              type='HeaderBig'
              style={{...stylesUsername, ...(currentlyFollowing ? stylesUsernameFollowing : stylesUsernameNotFollowing)}}
              onClick={() => this._onClickAvatar()}>
              {username}
            </Text>
            <Text type='BodySemibold' style={stylesFullname}>{userInfo.fullname}</Text>
            {followLabel &&
              <Text type='BodySmall' style={stylesFollowLabel}>{followLabel}</Text>
            }
            <Text type='BodySmall' style={stylesFollowing}>
              <span className='hover-underline' onClick={() => this._onClickFollowers()}>
                <Text type='BodySmall' style={{...globalStyles.fontBold}}>{userInfo.followersCount}</Text> {userInfo.followersCount === 1 ? 'Tracker' : 'Trackers'}
              </span>
              &nbsp;
              &middot;
              &nbsp;
              <span className='hover-underline' onClick={() => this._onClickFollowing()}>
                Tracking <Text type='BodySmall' style={{...globalStyles.fontBold}}>{userInfo.followingCount}</Text>
              </span>
            </Text>
            {userInfo.bio &&
              <Text type='BodySmall' style={stylesBio} lineClamp={userInfo.location ? 2 : 3}>
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

const stylesOuter = {
  marginTop: 90
}
const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 320,
  marginTop: -40
}
const stylesAvatarOuter = {
  width: avatarSize,
  height: avatarSize,
  position: 'relative',
  zIndex: 2
}
const stylesContent = {
  backgroundColor: globalColors.white,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 320,
  marginTop: -35,
  paddingTop: 35,
  zIndex: 1
}
const stylesUsername = {
  ...globalStyles.selectable,
  marginTop: 7
}
const stylesUsernameFollowing = {
  color: globalColors.green2
}
const stylesUsernameNotFollowing = {
  color: globalColors.orange
}
const stylesFullname = {
  ...globalStyles.selectable,
  textAlign: 'center',
  color: '#444444'
}
const stylesFollowLabel = {
  fontSize: 11,
  textTransform: 'uppercase'
}
const stylesFollowing = {
  ...globalStyles.clickable
}
const stylesBio = {
  ...globalStyles.selectable,
  paddingLeft: 30,
  paddingRight: 30,
  textAlign: 'center'
}
const stylesLocation = {
  ...globalStyles.selectable,
  paddingLeft: 30,
  paddingRight: 30,
  textAlign: 'center'
}

const followBadgeCommon = {
  position: 'absolute',
  background: globalColors.white,
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: `2px solid ${globalColors.white}`
}

const followTop = {
  ...followBadgeCommon,
  bottom: 5,
  right: 2
}

const followBottom = {
  ...followBadgeCommon,
  bottom: 0,
  right: 8
}

const followBadgeStyles = {
  followsYou: {
    ...followTop,
    background: globalColors.green
  },
  notFollowsYou: {
    ...followTop,
    background: globalColors.grey
  },
  following: {
    ...followBottom,
    background: globalColors.green
  },
  notFollowing: {
    ...followBottom,
    background: globalColors.grey
  }
}
