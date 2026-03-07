// Minimal fast Avatar (desktop).
import './avatar.css'
import type * as React from 'react'
import type * as T from '@/constants/types'
import * as Styles from '@/styles'
import {useConfigState} from '@/stores/config'
import * as AvatarZus from './store'
import {navToProfile} from '@/constants/router'
import {iconTypeToImgSet, type IconType} from '../icon'

type Props = {
  children?: React.ReactNode
  crop?: T.Teams.AvatarCrop
  imageOverrideUrl?: string
  isTeam?: boolean
  onClick?: ((e?: React.BaseSyntheticEvent) => void) | 'profile'
  size: 128 | 96 | 64 | 48 | 32 | 24 | 16
  style?: Styles.CustomStyles<'borderStyle'>
  teamname?: string
  username?: string
}

const avatarPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-placeholder-avatar-192',
  '256': 'icon-placeholder-avatar-256',
  '960': 'icon-placeholder-avatar-960',
}
const teamPlaceHolders: {[key: string]: IconType} = {
  '192': 'icon-team-placeholder-avatar-192',
  '256': 'icon-team-placeholder-avatar-256',
  '960': 'icon-team-placeholder-avatar-960',
}

const AVATAR_CONTAINER_SIZE = 175
const AVATAR_BORDER_SIZE = 4
const AVATAR_SIZE = AVATAR_CONTAINER_SIZE - AVATAR_BORDER_SIZE * 2

function Avatar(p: Props) {
  const {size, teamname, username, isTeam: _isTeam, onClick: _onClick, style, children} = p
  const {imageOverrideUrl, crop} = p
  const isTeam = _isTeam || !!teamname
  const name = isTeam ? teamname : username
  const counter = AvatarZus.useAvatarState(s => s.counts.get(name || '') ?? 0)
  const httpSrv = useConfigState(s => s.httpSrv)
  const {address, token} = httpSrv

  const avatarSizeClassName = `avatar-${isTeam ? 'team' : 'user'}-size-${size}`

  let bgImage: string | undefined
  if (imageOverrideUrl) {
    bgImage = `url("${encodeURI(imageOverrideUrl)}")`
  } else if (address && name) {
    const typ = isTeam ? 'team' : 'user'
    const imgSize = size <= 64 ? 192 : size <= 96 ? 256 : 960
    bgImage = `url(http://${address}/av?typ=${typ}&name=${name}&format=square_${imgSize}&mode=light&token=${token}&count=${counter})`
  }

  const placeholderBg = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, size)

  const onClick =
    _onClick === 'profile' ? (username ? () => navToProfile(username) : undefined) : _onClick

  const hasCrop = crop?.offsetLeft !== undefined && crop.offsetTop !== undefined
  const scaledAvatarRatio = size / AVATAR_SIZE
  const avatarScaledWidth = crop?.scaledWidth ? crop.scaledWidth * scaledAvatarRatio : null

  const showBg = bgImage || placeholderBg

  return (
    <div
      className={Styles.classNames('avatar', avatarSizeClassName)}
      onClick={onClick}
      style={Styles.collapseStyles([onClick && clickableStyle, style]) as React.CSSProperties}
    >
      <div className={Styles.classNames('avatar-inner', avatarSizeClassName)}>
        <div className="avatar-background" />
        {!!showBg && (
          <div className="avatar-user-image" style={{backgroundImage: showBg}} />
        )}
        {!!bgImage && hasCrop && (
          <div
            className="avatar-user-image"
            style={{
              backgroundImage: bgImage,
              backgroundPositionX: (crop.offsetLeft ?? 0) * scaledAvatarRatio,
              backgroundPositionY: (crop.offsetTop ?? 0) * scaledAvatarRatio,
              backgroundSize: `${avatarScaledWidth}px auto`,
            }}
          />
        )}
        {isTeam && (
          <div
            style={borderTeamStyle}
            className={Styles.classNames('avatar-border-team', avatarSizeClassName)}
          />
        )}
      </div>
      {children}
    </div>
  )
}

const clickableStyle = {cursor: 'pointer'} as const

const borderTeamStyle = {
  boxShadow: `0px 0px 0px 1px ${Styles.globalColors.black_10} inset`,
} satisfies React.CSSProperties

export default Avatar
