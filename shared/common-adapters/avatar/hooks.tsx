// High level avatar class. Handdles converting from usernames to urls. Deals with testing mode.
import * as C from '@/constants'
import * as React from 'react'
import {urlsToImgSet, urlsToSrcSet, urlsToBaseSrc} from '../icon'
import * as Styles from '@/styles'
import * as AvatarZus from './store'
import './avatar.css'
import type {Props} from '.'

export const avatarSizes = [128, 96, 64, 48, 32, 24, 16] as const
export type AvatarSize = (typeof avatarSizes)[number]

const avatarPlaceHolders: {[key: string]: string} = {
  '192': 'avatar-placeholder-192',
  '256': 'avatar-placeholder-256',
  '960': 'avatar-placeholder-960',
}

const avatarLighterPlaceHolders: {[key: string]: string} = {
  '192': 'avatar-placeholder-lighter-192',
  '256': 'avatar-placeholder-lighter-256',
  '960': 'avatar-placeholder-lighter-960',
}

const teamPlaceHolders: {[key: string]: string} = {
  '192': 'avatar-team-placeholder-192',
  '256': 'avatar-team-placeholder-256',
  '960': 'avatar-team-placeholder-960',
}

const followSizeToStyle = new Map([
  [128, {bottom: 0, left: 88, position: 'absolute'}],
  [48, {bottom: 0, left: 30, position: 'absolute'}],
  [64, {bottom: 0, left: 44, position: 'absolute'}],
  [96, {bottom: 0, left: 65, position: 'absolute'}],
  [32, undefined],
  [24, undefined],
  [16, undefined],
] as const)

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
export default (ownProps: Props) => {
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
  // For placeholders, use CSS classes instead of inline styles
  const getPlaceholderSize = (targetSize: number) => {
    if (targetSize >= 960) return '960'
    if (targetSize >= 256) return '256'
    return '192'
  }

  const placeholderClassName = React.useMemo(() => {
    if (imageOverrideUrl || (address && name)) return undefined
    const placeholderSize = getPlaceholderSize(size)
    const placeholders = isTeam ? teamPlaceHolders : lighterPlaceholders ? avatarLighterPlaceHolders : avatarPlaceHolders
    return placeholders[placeholderSize]
  }, [address, name, imageOverrideUrl, lighterPlaceholders, size, isTeam])

  const url = React.useMemo(
    () =>
      imageOverrideUrl
        ? `url("${encodeURI(imageOverrideUrl)}")`
        : address && name
          ? urlsToImgSet(urlMap, size)
          : null,
    [address, name, imageOverrideUrl, size, urlMap]
  )

  // For <img> tags (desktop only): extract src and srcset
  const src = React.useMemo(
    () =>
      Styles.isMobile
        ? null
        : imageOverrideUrl
          ? imageOverrideUrl
          : address && name
            ? urlsToBaseSrc(urlMap, size)
            : null,
    [address, name, imageOverrideUrl, size, urlMap]
  )

  const srcset = React.useMemo(
    () =>
      Styles.isMobile
        ? undefined
        : imageOverrideUrl
          ? undefined
          : address && name
            ? urlsToSrcSet(urlMap, size)
            : undefined,
    [address, name, imageOverrideUrl, size, urlMap]
  )

  const iconInfo = React.useMemo(
    () => followIconHelper(size, followsYou, following),
    [size, followsYou, following]
  )

  return {
    blocked: blocked,
    borderColor: ownProps.borderColor,
    children: ownProps.children,
    crop: ownProps.crop,
    editable: ownProps.editable,
    followIconSize: iconInfo.iconSize,
    followIconStyle: iconInfo.iconStyle,
    followIconType: iconInfo.iconType,
    isTeam: isTeam,
    loadingColor: ownProps.loadingColor,
    name: name || '',
    onClick: onClick,
    onEditAvatarClick: ownProps.onEditAvatarClick,
    opacity: ownProps.opacity,
    placeholderClassName: placeholderClassName,
    size: size,
    skipBackground: ownProps.skipBackground,
    src: src,
    srcset: srcset,
    style: ownProps.style,
    url: url,
  }
}
