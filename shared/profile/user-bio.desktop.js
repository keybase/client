// @flow
// TODO deprecate
import * as shared from './user-bio.shared'
import React, {Component} from 'react'
import {Avatar, Box, Button, Text, Placeholder} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles, desktopStyles} from '../styles'
import {stateColors} from '../util/tracker'
import type {AvatarSize} from '../common-adapters/avatar'
import type {Props} from './user-bio'

const placeholderStyle = {
  marginTop: globalMargins.small,
}

class BioLoading extends Component<{style?: any, avatarSize: AvatarSize, loading: boolean}, void> {
  render() {
    return (
      <Box style={{position: 'absolute'}}>
        <Box style={stylesContainer}>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              alignItems: 'flex-end',
              opacity: this.props.loading ? 1 : 0,
              position: 'relative',
              ...desktopStyles.fadeOpacity,
              zIndex: 2,
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
            <Placeholder style={placeholderStyle} />
            <Placeholder style={placeholderStyle} />
            <Placeholder style={placeholderStyle} />
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

    const _onClickAvatar = this.props.onClickAvatar
    const onClickAvatar = _onClickAvatar ? () => _onClickAvatar(username) : undefined

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
              opacity: loading ? 0 : 1,
              position: 'relative',
              zIndex: 2,
            }}
          >
            <Avatar
              editable={!!editFns}
              onClick={editFns ? () => editFns.onEditAvatarClick() : onClickAvatar}
              onEditAvatarClick={editFns ? () => editFns.onEditAvatarClick() : undefined}
              style={
                onClickAvatar || !!editFns ? platformStyles({isElectron: desktopStyles.clickable}) : null
              }
              username={username}
              size={avatarSize}
              showFollowingStatus={true}
            />
          </Box>
          <Box style={{...stylesContent, ...desktopStyles.fadeOpacity, opacity: loading ? 0 : 1}}>
            <Text
              type="HeaderBig"
              selectable={true}
              style={{...stylesUsername, color: trackerStateColors.username}}
              onClick={onClickAvatar}
            >
              {username}
            </Text>
            <Text center={true} type="BodyBig" selectable={true} style={stylesFullname} {...nameTweaks}>
              {userInfo.fullname}
            </Text>
            {!userInfo.fullname && editFns && (
              <Text
                type="BodySemibold"
                selectable={true}
                center={true}
                style={{...stylesFullname, color: globalColors.black_20}}
                {...nameTweaks}
              >
                Your full name
              </Text>
            )}
            {!editFns && followLabel && (
              <Text type="BodySmall" style={{...stylesFollowLabel, marginTop: 4}}>
                {followLabel}
              </Text>
            )}
            {userInfo.followersCount !== -1 && (
              <Box style={{...globalStyles.flexBoxRow, margin: 4}}>
                <Text type="BodySmall" style={{...globalStyles.fontBold}}>
                  {userInfo.followersCount}
                  <Text type="BodySmall">
                    &nbsp;Follower
                    {userInfo.followersCount === 1 ? '' : 's'}
                  </Text>
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
                center={true}
                type="Body"
                selectable={true}
                style={stylesBio}
                {...bioLineClamp}
                {...bioTweaks}
              >
                {userInfo.bio}
              </Text>
            )}
            {!userInfo.bio && editFns && (
              <Text
                type={this.props.type === 'Profile' ? 'Body' : 'BodySmall'}
                onClick={editFns.onBioEdit}
                selectable={true}
                center={true}
                style={{...stylesBio, color: globalColors.black_20}}
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
                center={true}
                style={stylesLocation}
                {...locationLineClamp}
                {...locationTweaks}
              >
                {userInfo.location}
              </Text>
            )}
            {!userInfo.location && editFns && (
              <Text
                type="BodySmall"
                selectable={true}
                center={true}
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
                type="Secondary"
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

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  width: 320,
}
const stylesContent = {
  alignItems: 'center',
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  justifyContent: 'center',
  marginTop: -35,
  paddingBottom: globalMargins.tiny,
  paddingTop: 35,
  width: 320,
  zIndex: 1,
}
const stylesUsername = {
  marginTop: 7,
}
const stylesFullname = {
  color: globalColors.black_75,
}
const stylesFollowLabel = platformStyles({
  isElectron: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
})
const stylesBio = {
  marginBottom: globalMargins.xtiny,
  paddingLeft: 30,
  paddingRight: 30,
}
const stylesLocation = {
  paddingLeft: 30,
  paddingRight: 30,
}

export default BioRender
