// @flow
import * as shared from './user-bio.shared'
import React, {Component} from 'react'
import ReactCSSTransitionGroup from 'react-addons-css-transition-group'
import {Avatar, Box, Button, Icon, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {stateColors} from '../util/tracker'

import type {AvatarSize} from './avatar'
import type {Props} from './user-bio'

class BioLoading extends Component<void, {style: Object, avatarSize: AvatarSize, loading: boolean}, void> {
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
              ...globalStyles.fadeOpacity,
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
          <Box style={{...stylesContent, ...globalStyles.fadeOpacity, opacity: this.props.loading ? 1 : 0}}>
            <Box style={{backgroundColor: globalColors.lightGrey, height: 13, marginTop: 11, width: 157}} />
            <Box style={{backgroundColor: globalColors.lightGrey, height: 13, marginTop: 11, width: 87}} />
            <Box style={{backgroundColor: globalColors.lightGrey, height: 13, marginTop: 11, width: 117}} />
          </Box>
        </Box>
      </Box>
    )
  }
}

class BioRender extends Component<void, Props, void> {
  render() {
    const {
      avatarSize,
      currentlyFollowing,
      loading,
      isYou,
      onBioEdit,
      onEditAvatarClick,
      onEditProfile,
      onLocationEdit,
      onNameEdit,
      trackerState,
      type,
      userInfo,
      username,
    } = this.props

    if (!userInfo) {
      return null
    }

    const {followsYou} = userInfo
    const followLabel = shared.followLabel(userInfo, currentlyFollowing)

    const trackerStateColors = stateColors(currentlyFollowing, trackerState)

    let [bioLineClamp, locationLineClamp] = [{}, {}]
    if (type === 'Tracker') {
      bioLineClamp = {lineClamp: userInfo.location ? 2 : 3}
      locationLineClamp = {lineClamp: 1}
    }

    const nameTweaks = isYou ? {className: 'hover-underline', onClick: onNameEdit} : {}
    const locationTweaks = isYou ? {className: 'hover-underline', onClick: onLocationEdit} : {}
    const bioTweaks = isYou ? {className: 'hover-underline', onClick: onBioEdit} : {}

    return (
      <Box style={{minHeight: 190, ...this.props.style}}>
        <ReactCSSTransitionGroup
          transitionName="no-anim"
          transitionEnterTimeout={250}
          transitionLeaveTimeout={250}
        >
          {loading &&
            <BioLoading
              key="loading-state"
              loading={loading}
              style={this.props.style}
              avatarSize={this.props.avatarSize}
            />}
        </ReactCSSTransitionGroup>
        <Box style={stylesContainer}>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              ...globalStyles.fadeOpacity,
              alignItems: 'flex-end',
              zIndex: 2,
              position: 'relative',
              opacity: loading ? 0 : 1,
            }}
          >
            <Avatar
              onClick={() => this.props.onClickAvatar(username)}
              style={globalStyles.clickable}
              username={username}
              size={avatarSize}
              following={currentlyFollowing && !isYou}
              followsYou={followsYou && !isYou}
            />
            {!!onEditAvatarClick &&
              <Box style={{height: 16, width: 0}}>
                <Icon
                  type="iconfont-edit"
                  onClick={onEditAvatarClick}
                  style={stylesEditAvatarIcon(avatarSize)}
                />
              </Box>}
          </Box>
          <Box style={{...stylesContent, ...globalStyles.fadeOpacity, opacity: loading ? 0 : 1}}>
            <Text
              type="HeaderBig"
              style={{...stylesUsername, color: trackerStateColors.username}}
              onClick={() => this.props.onClickAvatar(username)}
            >
              {username}
            </Text>
            <Text type="BodyBig" style={stylesFullname} {...nameTweaks}>{userInfo.fullname}</Text>
            {!userInfo.fullname &&
              !!nameTweaks.onClick &&
              <Text
                type="BodySemibold"
                style={{...stylesFullname, color: globalColors.black_20}}
                {...nameTweaks}
              >
                Your full name
              </Text>}
            {!isYou &&
              followLabel &&
              <Text type="BodySmall" style={{...stylesFollowLabel, marginTop: 4}}>{followLabel}</Text>}
            {userInfo.followersCount !== -1 &&
              <Box style={{...globalStyles.flexBoxRow, margin: 4}}>
                <Text
                  type="BodySmallSecondaryLink"
                  style={{...globalStyles.fontBold}}
                  onClick={() => this.props.onClickFollowers(username)}
                >
                  {userInfo.followersCount}
                  <Text type="BodySmallSecondaryLink">
                    &nbsp;Follower{userInfo.followersCount === 1 ? '' : 's'}
                  </Text>
                </Text>
                <Text type="BodySmall">&nbsp; &middot; &nbsp;</Text>
                <Text type="BodySmallSecondaryLink" onClick={() => this.props.onClickFollowing(username)}>
                  Following&nbsp;
                  <Text type="BodySmallSecondaryLink" style={{...globalStyles.fontBold}}>
                    {userInfo.followingCount}
                  </Text>
                </Text>
              </Box>}
            {userInfo.bio &&
              <Text
                type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'}
                style={{...stylesBio, ...stylesBioType[this.props.type]}}
                {...bioLineClamp}
                {...bioTweaks}
              >
                {userInfo.bio}
              </Text>}
            {!userInfo.bio &&
              isYou &&
              <Text
                type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'}
                onClick={onBioEdit}
                style={{...stylesBio, ...stylesBioType[this.props.type], color: globalColors.black_20}}
                {...bioTweaks}
                {...bioLineClamp}
              >
                Write a brief bio
              </Text>}

            {userInfo.location &&
              <Text type="BodySmall" style={stylesLocation} {...locationLineClamp} {...locationTweaks}>
                {userInfo.location}
              </Text>}
            {!userInfo.location &&
              isYou &&
              <Text
                type="BodySmall"
                style={{...stylesLocation, color: globalColors.black_20}}
                {...locationLineClamp}
                {...locationTweaks}
              >
                Wherever, Earth
              </Text>}
            {isYou &&
              <Button
                style={{marginTop: globalMargins.small}}
                type="Primary"
                label="Edit profile"
                onClick={onEditProfile}
              />}
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
    marginBottom: globalMargins.xtiny,
  },
  Tracker: {},
}
const stylesLocation = {
  ...globalStyles.selectable,
  paddingLeft: 30,
  paddingRight: 30,
  textAlign: 'center',
}

export default BioRender
