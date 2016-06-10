/* @flow */

import React, {Component} from 'react'
import {Text, Avatar} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import electron from 'electron'

const shell = electron.shell || electron.remote.shell

import type {Props} from './user-bio'

export default class BioRender extends Component {
  props: Props;

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
    const {avatarSize, username, userInfo, currentlyFollowing} = this.props
    if (!userInfo) {
      return null
    }

    const followsYou = userInfo.followsYou
    const followLabel = this._followLabel()

    return (
      <div style={stylesOuter}>
        <div style={stylesContainer}>
          <Avatar
            onClick={() => this._onClickAvatar()}
            style={{...globalStyles.clickable, zIndex: 2}}
            url={userInfo.avatar}
            size={avatarSize}
            following={currentlyFollowing}
            followsYou={followsYou} />
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
