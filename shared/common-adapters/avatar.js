// @flow
// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
// import * as React from 'react'
import Render from './avatar.render'
import pickBy from 'lodash/pickBy'
import {iconTypeToImgSet, urlsToImgSet} from './icon'
import {isTesting} from '../local-debug'
import {connect, type TypedState, lifecycle, compose} from '../util/container'
import {globalStyles} from '../styles'
import * as ConfigGen from '../actions/config-gen'

import type {IconType} from './icon'
import type {URLType, AvatarSize} from './avatar.render'

export type URLMap = {
  '200': string,
  '360': string,
  '40': string,
}

export type UserPictureSize = 360 | 200 | 40
export type AvatarLookupCallback = (username: string, urlMap: ?URLMap) => void
export type AvatarLookup = (username: string) => ?URLMap
export type AvatarLoad = (username: string, callback: AvatarLookupCallback) => void
export type TeamAvatarLookup = (teamname: string) => ?URLMap
export type TeamAvatarLoad = (teamname: string, callback: AvatarLookupCallback) => void
export type Props = {
  borderColor?: string,
  children?: any,
  following?: ?boolean,
  followsYou?: ?boolean,
  isTeam?: boolean,
  loadingColor?: string,
  onAvatarLoaded?: () => void,
  onClick?: ?() => void,
  opacity?: number,
  skipBackground?: boolean,
  size: AvatarSize,
  style?: ?Object,
  username?: ?string,
  teamname?: ?string,
}

type State = {
  url: URLType,
}

const avatarPlaceHolders: {[key: string]: IconType} = {
  '112': 'icon-placeholder-avatar-112',
  '12': 'icon-placeholder-avatar-12',
  '16': 'icon-placeholder-avatar-16',
  '176': 'icon-placeholder-avatar-176',
  '24': 'icon-placeholder-avatar-24',
  '32': 'icon-placeholder-avatar-32',
  '40': 'icon-placeholder-avatar-40',
  '48': 'icon-placeholder-avatar-48',
  '64': 'icon-placeholder-avatar-64',
  '80': 'icon-placeholder-avatar-80',
}

const teamPlaceHolders: {[key: string]: IconType} = {
  '112': 'icon-team-placeholder-avatar-112',
  '12': 'icon-team-placeholder-avatar-12',
  '16': 'icon-team-placeholder-avatar-16',
  '176': 'icon-team-placeholder-avatar-176',
  '24': 'icon-team-placeholder-avatar-24',
  '32': 'icon-team-placeholder-avatar-32',
  '40': 'icon-team-placeholder-avatar-40',
  '48': 'icon-team-placeholder-avatar-48',
  '64': 'icon-team-placeholder-avatar-64',
  '80': 'icon-team-placeholder-avatar-80',
}

const followStateToType = {
  '112': {
    theyNo: {youYes: 'icon-following-28'},
    theyYes: {youNo: 'icon-follow-me-28', youYes: 'icon-mutual-follow-28'},
  },
  '176': {
    theyNo: {youYes: 'icon-following-32'},
    theyYes: {youNo: 'icon-follow-me-32', youYes: 'icon-mutual-follow-32'},
  },
  '48': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
  '64': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
  '80': {
    theyNo: {youYes: 'icon-following-21'},
    theyYes: {youNo: 'icon-follow-me-21', youYes: 'icon-mutual-follow-21'},
  },
}

const followStateToSize = {
  '112': {
    theyNo: {youYes: 28},
    theyYes: {youNo: 28, youYes: 28},
  },
  '176': {
    theyNo: {youYes: 32},
    theyYes: {youNo: 32, youYes: 32},
  },
  '48': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
  '64': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
  '80': {
    theyNo: {youYes: 21},
    theyYes: {youNo: 21, youYes: 21},
  },
}

const followSizeToStyle = {
  '112': {bottom: 0, left: 80, position: 'absolute'},
  '176': {bottom: 6, left: 132, position: 'absolute'},
  '48': {bottom: 0, left: 32, position: 'absolute'},
  '64': {bottom: 0, left: 45, position: 'absolute'},
  '80': {bottom: 0, left: 57, position: 'absolute'},
}

const mapStateToProps = (state: TypedState, ownProps: Props) => {
  let _urlMap

  if (ownProps.username) {
    _urlMap = state.config.avatars[ownProps.username]
  }

  return {
    _needAskForData: !state.config.avatars.hasOwnProperty(ownProps.username),
    _urlMap,
  }
}

function _followIconType(size: number, followsYou: boolean, following: boolean) {
  const sizeString = String(size)
  if (followStateToType.hasOwnProperty(sizeString)) {
    return followStateToType[sizeString][followsYou ? 'theyYes' : 'theyNo'][following ? 'youYes' : 'youNo']
  }
  return null
}

function _followIconSize(size: number, followsYou: boolean, following: boolean) {
  const sizeString = String(size)
  if (followStateToSize.hasOwnProperty(sizeString)) {
    return followStateToSize[sizeString][followsYou ? 'theyYes' : 'theyNo'][following ? 'youYes' : 'youNo']
  }
  return 0
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _askForUserData: (username: string) => dispatch(ConfigGen.createLoadAvatar({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  let style
  if (ownProps.style) {
    if (ownProps.onClick) {
      style = {...ownProps.style, ...globalStyles.clickable}
    } else {
      style = ownProps.style
    }
  } else if (ownProps.onClick) {
    style = globalStyles.clickable
  }

  let url
  let isPlaceholder

  if (stateProps._urlMap) {
    url = urlsToImgSet(pickBy(stateProps._urlMap, value => value), ownProps.size)
    isPlaceholder = false
  }

  if (!url) {
    url = iconTypeToImgSet(avatarPlaceHolders[String(ownProps.size)], ownProps.size)
    isPlaceholder = true
  }

  return {
    _askForUserData: stateProps._needAskForData
      ? () => dispatchProps._askForUserData(ownProps.username)
      : null,
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    followIconSize: _followIconSize(ownProps.size, ownProps.followsYou, ownProps.following),
    followIconStyle: followSizeToStyle[ownProps.size],
    followIconType: _followIconType(ownProps.size, ownProps.followsYou, ownProps.following),
    isPlaceholder,
    isTeam: !!ownProps.teamname,
    loadingColor: ownProps.loadingColor,
    onClick: ownProps.onClick,
    opacity: ownProps.opacity,
    size: ownProps.size,
    style,
    url,
  }
}

// We could theoretically bundle all these requests into one action but this is simpler for now
export type {AvatarSize}
export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentWillMount() {
      this.setState({_askForUserData: this.props._askForUserData, _mounted: true})
      setTimeout(() => {
        // Still looking at the same user?
        if (this.state._mounted && this.props._askForUserData === this.state._askForUserData) {
          if (this.props._askForUserData) {
            this.props._askForUserData()
          }
        }
      }, 300)
    },
    componentWillUnmount() {
      this.setState({_askForUserData: null, _mounted: false})
    },
  })
)(Render)
