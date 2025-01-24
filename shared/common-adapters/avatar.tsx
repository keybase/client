// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as C from '@/constants'
import * as React from 'react'
import Avatar from './avatar.render'
import {iconTypeToImgSet, urlsToImgSet, type IconType, type IconStyle} from './icon'
import * as Styles from '@/styles'
import * as AvatarZus from './avatar-zus'
import type * as T from '@/constants/types'
import './avatar.css'

export const avatarSizes = [128, 96, 64, 48, 32, 24, 16] as const
export type AvatarSize = (typeof avatarSizes)[number]

type URLType = string

export type OwnProps = {
  borderColor?: string
  children?: React.ReactNode
  crop?: T.Teams.AvatarCrop
  lighterPlaceholders?: boolean
  editable?: boolean
  imageOverrideUrl?: string
  isTeam?: boolean
  loadingColor?: string
  onClick?: ((e?: React.BaseSyntheticEvent) => void) | 'profile'
  onEditAvatarClick?: (e?: React.BaseSyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  style?: Styles.CustomStyles<'borderStyle'>
  teamname?: string
  username?: string
  showFollowingStatus?: boolean // show the green dots or not
}

export type Props = {
  borderColor?: string
  children?: React.ReactNode
  crop?: T.Teams.AvatarCrop
  editable?: boolean
  followIconSize: number
  followIconType?: IconType
  followIconStyle: IconStyle
  imageOverride?: string
  isTeam: boolean
  loadingColor?: string
  name: string
  onClick?: (e?: React.SyntheticEvent) => void
  onEditAvatarClick?: (e?: React.SyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  style?: Styles.CustomStyles<'borderStyle'>
  teamname?: string
  url: URLType
  username?: string
}

const avatarPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-placeholder-avatar-192',
  '256': 'icon-placeholder-avatar-256',
  '960': 'icon-placeholder-avatar-960',
}

const avatarLighterPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-placeholder-avatar-lighter-192',
  '256': 'icon-placeholder-avatar-lighter-256',
  '960': 'icon-placeholder-avatar-lighter-960',
}

const teamPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-team-placeholder-avatar-192',
  '256': 'icon-team-placeholder-avatar-256',
  '960': 'icon-team-placeholder-avatar-960',
}

const followSizeToStyle = new Map<AvatarSize, IconStyle>([
  [128, {bottom: 0, left: 88, position: 'absolute'}],
  [48, {bottom: 0, left: 30, position: 'absolute'}],
  [64, {bottom: 0, left: 44, position: 'absolute'}],
  [96, {bottom: 0, left: 65, position: 'absolute'}],
])

const followIconHelper = (size: AvatarSize, followsYou: boolean, following: boolean) => {
  const iconSize = size === 128 ? (28 as const) : (21 as const)
  const rel =
    followsYou === following ? (followsYou ? 'mutual-follow' : null) : followsYou ? 'follow-me' : 'following'
  const iconType = rel ? (`icon-${rel}-${iconSize}` as const) : undefined
  const iconStyle = followSizeToStyle.get(size)
  return {
    iconSize,
    iconStyle,
    iconType,
  }
}

const sizes = [960, 256, 192] as const
const ConnectedAvatar = (ownProps: OwnProps) => {
  const {username, showFollowingStatus, teamname, isTeam: _isTeam, onClick: _onClick} = ownProps
  const {onEditAvatarClick, imageOverrideUrl, size, lighterPlaceholders} = ownProps
  const isTeam = _isTeam || !!teamname
  const counter = AvatarZus.useAvatarState(s => s.counts.get(username || teamname || '') ?? 0)
  const following = C.useFollowerState(s =>
    showFollowingStatus && username ? s.following.has(username) : false
  )
  const followsYou = C.useFollowerState(s =>
    showFollowingStatus && username ? s.followers.has(username) : false
  )
  const httpSrv = C.useConfigState(s => s.httpSrv)
  const blocked = C.useUsersState(s => s.blockMap.get(username || teamname || '')?.chatBlocked)
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const goToProfile = React.useCallback(
    () => username && showUserProfile(username),
    [showUserProfile, username]
  )

  const opClick = _onClick === 'profile' ? (username ? goToProfile : undefined) : _onClick
  const onClick = onEditAvatarClick || opClick
  const name = isTeam ? teamname : username

  const {address, token} = httpSrv

  const isDarkMode = Styles.useIsDarkMode()

  const urlMap = React.useMemo(
    () =>
      sizes.reduce<{[key: number]: string}>((m, size) => {
        m[size] = `http://${address}/av?typ=${
          isTeam ? 'team' : 'user'
        }&name=${name}&format=square_${size}&mode=${isDarkMode ? 'dark' : 'light'}&token=${
          token
        }&count=${counter}`
        return m
      }, {}),
    [counter, address, token, isTeam, name, isDarkMode]
  )
  const url = React.useMemo(
    () =>
      imageOverrideUrl
        ? `url("${encodeURI(imageOverrideUrl)}")`
        : address && name
          ? urlsToImgSet(urlMap, size)
          : iconTypeToImgSet(
              isTeam
                ? teamPlaceHolders
                : lighterPlaceholders
                  ? avatarLighterPlaceHolders
                  : avatarPlaceHolders,
              size
            ),
    [address, name, imageOverrideUrl, lighterPlaceholders, size, urlMap, isTeam]
  )
  const iconInfo = React.useMemo(
    () => followIconHelper(size, followsYou, following),
    [size, followsYou, following]
  )
  return (
    <Avatar
      blocked={blocked}
      borderColor={ownProps.borderColor}
      children={ownProps.children}
      crop={ownProps.crop}
      editable={ownProps.editable}
      followIconSize={iconInfo.iconSize}
      followIconStyle={iconInfo.iconStyle}
      followIconType={iconInfo.iconType}
      isTeam={isTeam}
      loadingColor={ownProps.loadingColor}
      name={name || ''}
      onClick={onClick}
      onEditAvatarClick={ownProps.onEditAvatarClick}
      opacity={ownProps.opacity}
      size={size}
      skipBackground={ownProps.skipBackground}
      style={ownProps.style}
      url={url}
    />
  )
}

export default React.memo(ConnectedAvatar)
