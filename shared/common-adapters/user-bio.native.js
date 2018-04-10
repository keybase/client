// @flow
import * as shared from './user-bio.shared'
import React, {Component} from 'react'
import Box from './box'
import Avatar from './avatar'
import Text from './text'
import {Button} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {stateColors} from '../util/tracker'

import type {AvatarSize} from './avatar'
import type {Props} from './user-bio'

class BioLoading extends Component<{style: any, avatarSize: AvatarSize, loading: boolean}, void> {
  render() {
    const {avatarSize, loading} = this.props

    return (
      <Box style={stylesContainer}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'flex-end',
            zIndex: 2,
            position: 'relative',
            opacity: loading ? 1 : 0,
            alignSelf: 'center',
          }}
        >
          <Box
            style={{
              backgroundColor: globalColors.lightGrey,
              borderRadius: avatarSize / 2,
              height: avatarSize,
              width: avatarSize,
            }}
          />
        </Box>
        <Box style={{...stylesContent, opacity: this.props.loading ? 1 : 0}}>
          <Box
            style={{
              ...globalStyles.loadingTextStyle,
              width: 160,
              marginTop: globalMargins.small,
              height: 16,
              borderRadius: 2,
            }}
          />
          <Box
            style={{
              ...globalStyles.loadingTextStyle,
              width: 160,
              marginTop: globalMargins.small,
              height: 16,
              borderRadius: 2,
            }}
          />
          <Box
            style={{
              ...globalStyles.loadingTextStyle,
              width: 160,
              marginTop: globalMargins.small,
              height: 16,
              borderRadius: 2,
            }}
          />
        </Box>
      </Box>
    )
  }
}

class BioRender extends Component<Props> {
  render() {
    const {avatarSize, currentlyFollowing, editFns, loading, userInfo, username} = this.props
    if (loading) {
      return (
        <Box style={{...stylesContainer, ...this.props.style}}>
          <BioLoading loading={loading} style={this.props.style} avatarSize={avatarSize} />
        </Box>
      )
    }

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

    const _onClickAvatar = this.props.onClickAvatar
    const onClickAvatar = _onClickAvatar ? () => _onClickAvatar(username) : undefined

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        <Box style={stylesHeaderBar(avatarSize, trackerStateColors.header.background)} />
        <Box style={stylesAvatarWrapper(avatarSize)}>
          <Avatar
            style={stylesAvatar}
            onClick={editFns ? editFns.onEditAvatarClick : onClickAvatar}
            username={username}
            size={avatarSize}
            following={currentlyFollowing}
            followsYou={followsYou}
          />
        </Box>
        <Box style={stylesContent}>
          <Text
            type="HeaderBig"
            selectable={true}
            style={{...stylesUsername, color: trackerStateColors.username}}
            onClick={onClickAvatar}
          >
            {username}
          </Text>
          {!!userInfo.fullname && (
            <Text type="BodySemibold" selectable={true} style={stylesFullname}>
              {userInfo.fullname}
            </Text>
          )}
          {!!followLabel && (
            <Text type="BodySmall" style={stylesFollowLabel}>
              {followLabel.toUpperCase()}
            </Text>
          )}
          <Text type="BodySmall" style={stylesFollowing}>
            <Text type="BodySmall" style={stylesFollowingLabel}>
              <Text type="BodySmall" style={stylesFollowingCount}>
                {userInfo.followersCount}
              </Text>{' '}
              {userInfo.followersCount === 1 ? 'Follower' : 'Followers'}
            </Text>
            &nbsp; &middot; &nbsp;
            <Text type="BodySmall" style={stylesFollowingLabel}>
              Following{' '}
              <Text type="BodySmall" style={stylesFollowingCount}>
                {userInfo.followingCount}
              </Text>
            </Text>
          </Text>
          {!!userInfo.bio && (
            <Text
              type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'}
              selectable={true}
              style={stylesBio}
              {...bioLineClamp}
            >
              {userInfo.bio}
            </Text>
          )}
          {!!userInfo.location && (
            <Text type="BodySmall" selectable={true} style={stylesLocation} {...locationLineClamp}>
              {userInfo.location}
            </Text>
          )}
          {editFns && (
            <Button
              label="Edit profile"
              onClick={editFns.onEditProfile}
              style={{marginTop: globalMargins.small}}
              type="Primary"
            />
          )}
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
const stylesAvatarWrapper = (avatarSize: number) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: avatarSize,
  marginTop: -avatarSize / 2,
})
const stylesAvatar = {}
const stylesContent = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}
const stylesUsername = {
  marginTop: globalMargins.tiny,
}
const stylesFullname = {
  textAlign: 'center',
  color: globalColors.black_75,
}
const stylesFollowLabel = {
  fontSize: 13,
  marginTop: globalMargins.xtiny,
  marginBottom: globalMargins.xtiny,
  color: globalColors.black_40,
}
const stylesFollowing = {
  color: globalColors.black_40,
  marginBottom: globalMargins.xtiny,
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
  textAlign: 'center',
  color: globalColors.black_75,
}
const stylesLocation = {
  textAlign: 'center',
  marginTop: globalMargins.xtiny,
}

export default BioRender
