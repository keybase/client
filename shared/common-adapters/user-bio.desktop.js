// @flow
import * as shared from './user-bio.shared'
import React, {Component} from 'react'
import {Avatar, Box, Button, Icon, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles, desktopStyles} from '../styles'
import {stateColors} from '../util/tracker'

import type {AvatarSize} from './avatar'
import type {Props} from './user-bio'

class BioLoading extends Component<{style?: any, avatarSize: AvatarSize, loading: boolean}, void> {
  render() {
    return (
      <Box style={{position: 'absolute'}}>
        <Box style={stylesContainer}>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              alignItems: 'flex-end',
              zIndex: 2,
              position: 'relative',
              ...desktopStyles.fadeOpacity,
              opacity: this.props.loading ? 1 : 0,
            }}
          >
            <Box
              style={{
                backgroundColor: globalColors.lightGrey,
                borderRadius: '50%',
                height: this.props.avatarSize,
                width: this.props.avatarSize,
              }}
            />
          </Box>
          <Box style={{...stylesContent, ...desktopStyles.fadeOpacity, opacity: this.props.loading ? 1 : 0}}>
            <Box style={{backgroundColor: globalColors.lightGrey, height: 13, marginTop: 11, width: 157}} />
            <Box style={{backgroundColor: globalColors.lightGrey, height: 13, marginTop: 11, width: 87}} />
            <Box style={{backgroundColor: globalColors.lightGrey, height: 13, marginTop: 11, width: 117}} />
          </Box>
        </Box>
      </Box>
    )
  }
}

class BioRender extends Component<Props> {
  render() {
    const {avatarSize, username, userInfo, currentlyFollowing, editFns, loading} = this.props
    if (!userInfo) {
      return null
    }

    const {followsYou} = userInfo
    const followLabel = shared.followLabel(userInfo, currentlyFollowing)

    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)

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
      <Box style={{minHeight: 190, ...this.props.style}}>
        {loading && (
          <BioLoading
            key="loading-state"
            loading={loading}
            style={this.props.style}
            avatarSize={this.props.avatarSize}
          />
        )}
        <Box style={stylesContainer}>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              ...desktopStyles.fadeOpacity,
              alignItems: 'flex-end',
              zIndex: 2,
              position: 'relative',
              opacity: loading ? 0 : 1,
            }}
          >
            <Avatar
              onClick={() => this.props.onClickAvatar(username)}
              style={platformStyles({isElectron: desktopStyles.clickable})}
              username={username}
              size={avatarSize}
              following={currentlyFollowing && !editFns}
              followsYou={followsYou && !editFns}
            />
            {editFns && (
              <Box style={{height: 16, width: 0}}>
                <Icon
                  type="iconfont-edit"
                  onClick={editFns.onEditAvatarClick}
                  style={stylesEditAvatarIcon(avatarSize)}
                />
              </Box>
            )}
          </Box>
          <Box style={{...stylesContent, ...desktopStyles.fadeOpacity, opacity: loading ? 0 : 1}}>
            <Text
              type="HeaderBig"
              selectable={true}
              style={{...stylesUsername, color: trackerStateColors.username}}
              onClick={() => this.props.onClickAvatar(username)}
            >
              {username}
            </Text>
            <Text type="BodyBig" selectable={true} style={stylesFullname} {...nameTweaks}>
              {userInfo.fullname}
            </Text>
            {!userInfo.fullname &&
              editFns && (
                <Text
                  type="BodySemibold"
                  selectable={true}
                  style={{...stylesFullname, color: globalColors.black_20}}
                  {...nameTweaks}
                >
                  Your full name
                </Text>
              )}
            {!editFns &&
              followLabel && (
                <Text type="BodySmall" style={{...stylesFollowLabel, marginTop: 4}}>
                  {followLabel}
                </Text>
              )}
            {userInfo.followersCount !== -1 && (
              <Box style={{...globalStyles.flexBoxRow, margin: 4}}>
                <Text type="BodySmall" style={{...globalStyles.fontBold}}>
                  {userInfo.followersCount}
                  <Text type="BodySmall">&nbsp;Follower{userInfo.followersCount === 1 ? '' : 's'}</Text>
                </Text>
                <Text type="BodySmall">&nbsp; &middot; &nbsp;</Text>
                <Text type="BodySmall">
                  Following&nbsp;
                  <Text type="BodySmall" style={{...globalStyles.fontBold}}>
                    {userInfo.followingCount}
                  </Text>
                </Text>
              </Box>
            )}
            {userInfo.bio && (
              <Text
                type={'Body'}
                selectable={true}
                style={{...stylesBio, ...stylesBioType[this.props.type]}}
                {...bioLineClamp}
                {...bioTweaks}
              >
                {userInfo.bio}
              </Text>
            )}
            {!userInfo.bio &&
              editFns && (
                <Text
                  type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'}
                  onClick={editFns.onBioEdit}
                  selectable={true}
                  style={{...stylesBio, ...stylesBioType[this.props.type], color: globalColors.black_20}}
                  {...bioTweaks}
                  {...bioLineClamp}
                >
                  Write a brief bio
                </Text>
              )}

            {userInfo.location && (
              <Text
                type="BodySmall"
                selectable={true}
                style={stylesLocation}
                {...locationLineClamp}
                {...locationTweaks}
              >
                {userInfo.location}
              </Text>
            )}
            {!userInfo.location &&
              editFns && (
                <Text
                  type="BodySmall"
                  selectable={true}
                  style={{...stylesLocation, color: globalColors.black_20}}
                  {...locationLineClamp}
                  {...locationTweaks}
                >
                  Wherever, Earth
                </Text>
              )}
            {editFns && (
              <Button
                style={{marginTop: globalMargins.small}}
                type="Primary"
                label="Edit profile"
                onClick={editFns.onEditProfile}
              />
            )}
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
  position: 'relative',
  width: 320,
}
const stylesContent = {
  backgroundColor: globalColors.white,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 320,
  marginTop: -35,
  paddingBottom: globalMargins.tiny,
  paddingTop: 35,
  zIndex: 1,
}
const stylesUsername = {
  marginTop: 7,
}
const stylesFullname = {
  textAlign: 'center',
  color: globalColors.black_75,
}
const stylesFollowLabel = platformStyles({
  isElectron: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
})
const stylesBio = {
  paddingLeft: 30,
  paddingRight: 30,
  textAlign: 'center',
}
const stylesBioType = {
  Profile: {
    marginBottom: globalMargins.xtiny,
  },
  Tracker: {},
}
const stylesLocation = {
  paddingLeft: 30,
  paddingRight: 30,
  textAlign: 'center',
}

export default BioRender
