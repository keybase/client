/* @flow */

import React, {Component} from 'react'
import {Avatar, Box, Button, Icon, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import * as shared from './user-bio.shared'

import type {Props} from './user-bio'

export default class BioRender extends Component {
  props: Props;

  render () {
    const {avatarSize, username, userInfo, currentlyFollowing, editFns} = this.props
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

    let [nameTweaks, locationTweaks, bioTweaks] = [{}, {}, {}]
    if (editFns) {
      nameTweaks = {className: 'hover-underline', onClick: editFns.onNameEdit}
      locationTweaks = {className: 'hover-underline', onClick: editFns.onLocationEdit}
      bioTweaks = {className: 'hover-underline', onClick: editFns.onBioEdit}
    }

    return (
      <Box style={this.props.style}>
        <Box style={stylesContainer}>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-end', zIndex: 2, position: 'relative'}}>
            <Avatar
              onClick={() => shared.onClickAvatar(username)}
              style={globalStyles.clickable}
              url={userInfo.avatar}
              size={avatarSize}
              following={currentlyFollowing}
              followsYou={followsYou || !!editFns} />
            {editFns &&
              <Box style={{height: 16, width: 16}}>
                <Icon
                  type='iconfont-edit'
                  onClick={editFns.onEditAvatarClick}
                  style={stylesEditAvatarIcon(avatarSize)} />
              </Box>}
          </Box>
          <Box style={stylesContent}>
            <Text
              type='HeaderBig'
              style={{...stylesUsername, ...shared.usernameStyle(this.props)}}
              onClick={() => shared.onClickAvatar(username)}>
              {username}
            </Text>
            <Text type='BodySemibold' style={stylesFullname} {...nameTweaks}>{userInfo.fullname}</Text>
            {!userInfo.fullname && editFns &&
              <Text type='BodySemibold' style={{...stylesFullname, color: globalColors.black_20}} {...nameTweaks}>Your full name</Text>}
            {!editFns && followLabel &&
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
              <Text type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'}
                style={{...stylesBio, ...stylesBioType[this.props.type]}} {...bioLineClamp}
                {...bioTweaks}>
                {userInfo.bio}
              </Text>
            }
            {!userInfo.bio && editFns &&
              <Text type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'}
                onClick={editFns.onBioEdit}
                style={{...stylesBio, ...stylesBioType[this.props.type], color: globalColors.black_20}}
                {...bioTweaks}
                {...bioLineClamp}>
                Write a brief bio
              </Text>}

            {userInfo.location &&
              <Text type='BodySmall' style={stylesLocation} {...locationLineClamp} {...locationTweaks}>{userInfo.location}</Text>
            }
            {!userInfo.location && editFns &&
              <Text type='BodySmall' style={{...stylesLocation, color: globalColors.black_20}} {...locationLineClamp} {...locationTweaks}>Wherever, Earth</Text>
            }
            {editFns &&
              <Button
                style={{marginTop: globalMargins.small}}
                type='Primary'
                label='Edit profile'
                onClick={editFns.onEditProfile} />}
          </Box>
        </Box>
      </Box>
    )
  }
}

const stylesEditAvatarIcon = avatarSize => ({
  // Hack to make the hover and onclick register over the avatar
  position: 'absolute',
  bottom: 0,
  right: 0,
  paddingTop: avatarSize,
  paddingLeft: avatarSize,
})

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
