// @flow
import * as shared from './user-bio.shared'
import React, {Component} from 'react'
import {Box, Avatar, Text} from './'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {stateColors} from '../util/tracker'

import type {AvatarSize} from './avatar'
import type {Props} from './user-bio'

class BioLoading extends Component<void, {style: Object, avatarSize: AvatarSize, loading: boolean}, void> {
  render () {
    const {avatarSize, loading} = this.props

    return (
      <Box style={stylesContainer}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-end', zIndex: 2, position: 'relative', opacity: loading ? 1 : 0, alignSelf: 'center'}}>
          <Avatar
            url={''}
            loadingColor={globalColors.lightGrey}
            forceLoading={true}
            size={avatarSize}
            following={false}
            followsYou={false} />
        </Box>
        <Box style={{...stylesContent, opacity: this.props.loading ? 1 : 0}}>
          <Box style={{...globalStyles.loadingTextStyle, width: 157, marginTop: 10, height: 26}} />
          <Box style={{...globalStyles.loadingTextStyle, width: 100, marginTop: 12, height: 18}} />
          <Box style={{...globalStyles.loadingTextStyle, width: 117, marginTop: globalMargins.tiny, marginBottom: 0}} />
          <Box style={{...globalStyles.loadingTextStyle, width: 247, marginTop: 6, marginBottom: 0}} />
        </Box>
      </Box>
    )
  }
}

class BioRender extends Component<void, Props, void> {
  render () {
    const {avatarSize, username, userInfo, currentlyFollowing, loading} = this.props
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
    const trackerStateColors = stateColors(this.props)

    let [bioLineClamp, locationLineClamp] = [{}, {}]
    if (this.props.type === 'Tracker') {
      bioLineClamp = {lineClamp: userInfo.location ? 2 : 3}
      locationLineClamp = {lineClamp: 1}
    }

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        <Box style={stylesHeaderBar(avatarSize, trackerStateColors.header.background)} />
        <Box style={stylesAvatarWrapper(avatarSize)}>
          <Avatar
            style={stylesAvatar}
            onClick={() => this.props.onClickAvatar(username)}
            url={userInfo.avatar}
            size={avatarSize}
            following={currentlyFollowing}
            followsYou={followsYou} />
        </Box>
        <Box style={stylesContent}>
          <Text
            type='HeaderBig'
            style={{...stylesUsername, color: trackerStateColors.username}}
            onClick={() => this.props.onClickAvatar(username)}>
            {username}
          </Text>
          <Text type='BodySemibold' style={stylesFullname}>{userInfo.fullname}</Text>
          {!!followLabel &&
            <Text type='BodySmall' style={stylesFollowLabel}>{followLabel.toUpperCase()}</Text>}
          <Text type='BodySmall' style={stylesFollowing}>
            <Text type='BodySmallLink' onClick={() => this.props.onClickFollowers(username)} style={stylesFollowingLabel}>
              <Text type='BodySmall' style={stylesFollowingCount}>{userInfo.followersCount}</Text> {userInfo.followersCount === 1 ? 'Follower' : 'Followers'}
            </Text>
            &nbsp;
            &middot;
            &nbsp;
            <Text type='BodySmallLink' onClick={() => this.props.onClickFollowing(username)} style={stylesFollowingLabel}>
              Following <Text type='BodySmall' style={stylesFollowingCount}>{userInfo.followingCount}</Text>
            </Text>
          </Text>
          {!!userInfo.bio &&
            <Text type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'} style={{...stylesBio}} {...bioLineClamp}>
              {userInfo.bio}
            </Text>}
          {!!userInfo.location &&
            <Text type='BodySmall' style={stylesLocation} {...locationLineClamp}>{userInfo.location}</Text>}
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
}
const stylesFollowLabel = {
  fontSize: 12,
  color: globalColors.black_40,
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

export default BioRender
