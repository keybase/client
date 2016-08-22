// @flow
import * as shared from './user-bio.shared'
import React, {Component} from 'react'
import {Box, Avatar, Text} from './'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {stateColors} from '../util/tracker'

import type {AvatarSize} from './avatar'
import type {Props} from './user-bio'

class BioLoading extends Component<void, {style: Object, avatarSize: AvatarSize, loading: boolean}, void> {
  render () {
    return (
      <Box style={{position: 'absolute', top: 0, left: 0, right: 0}}>
        <Box style={stylesContainer}>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-end', zIndex: 2, position: 'relative', opacity: this.props.loading ? 1 : 0, alignSelf: 'center'}}>
            <Avatar
              url={''}
              loadingColor={globalColors.lightGrey}
              forceLoading={true}
              size={this.props.avatarSize}
              following={false}
              followsYou={false} />
          </Box>
          <Box style={{...stylesContent, opacity: this.props.loading ? 1 : 0}}>
            <Box style={{...globalStyles.loadingTextStyle, width: 157, marginTop: 10, height: 26}} />
            <Box style={{...globalStyles.loadingTextStyle, width: 100, marginTop: 12, height: 16}} />
            <Box style={{...globalStyles.loadingTextStyle, width: 117, marginTop: globalMargins.tiny, marginBottom: 0}} />
            <Box style={{...globalStyles.flexBoxRow, marginTop: 6}}>
              <Box style={{...globalStyles.loadingTextStyle, width: 127, marginRight: 20}} />
              <Box style={{...globalStyles.loadingTextStyle, width: 117}} />
            </Box>
            <Box style={{...globalStyles.flexBoxColumn, position: 'absolute', left: globalMargins.medium, right: globalMargins.medium}}>
              <Box style={{...globalStyles.loadingTextStyle, marginTop: 14, height: 16}} />
              <Box style={{...globalStyles.loadingTextStyle, marginTop: globalMargins.tiny, height: 16}} />
              <Box style={{...globalStyles.loadingTextStyle, marginTop: globalMargins.tiny, height: 16, marginLeft: globalMargins.small, marginRight: globalMargins.small}} />
              <Box style={{...globalStyles.loadingTextStyle, width: 117, marginTop: 10, alignSelf: 'center'}} />
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

class BioRender extends Component<void, Props, void> {
  render () {
    const {avatarSize, username, userInfo, currentlyFollowing, loading} = this.props
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
            onClick={() => shared.onClickAvatar(username)}
            url={userInfo.avatar}
            size={avatarSize}
            following={currentlyFollowing}
            followsYou={followsYou} />
        </Box>
        <Box style={stylesContent}>
          <Text
            type='HeaderBig'
            style={{...stylesUsername, color: trackerStateColors.username}}
            onClick={() => shared.onClickAvatar(username)}>
            {username}
          </Text>
          <Text type='BodySemibold' style={stylesFullname}>{userInfo.fullname}</Text>
          {!!followLabel &&
            <Text type='BodySmall' style={stylesFollowLabel}>{followLabel.toUpperCase()}</Text>}
          <Text type='BodySmall' style={stylesFollowing}>
            <Text type='BodySmallLink' onClick={() => shared.onClickFollowers(username)} style={stylesFollowingLabel}>
              <Text type='BodySmall' style={stylesFollowingCount}>{userInfo.followersCount}</Text> {userInfo.followersCount === 1 ? 'Follower' : 'Followers'}
            </Text>
            &nbsp;
            &middot;
            &nbsp;
            <Text type='BodySmallLink' onClick={() => shared.onClickFollowing(username)} style={stylesFollowingLabel}>
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
        {loading && <BioLoading loading={loading} style={this.props.style} avatarSize={this.props.avatarSize} />}
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
