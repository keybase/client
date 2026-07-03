import './avatar.css'
import {useState} from 'react'
import * as Styles from '@/styles'
import {useConfigState} from '@/stores/config'
import * as AvatarZus from './store'
import {Pressable, View, useColorScheme} from 'react-native'
import {navToProfile} from '@/constants/router'
import {normalizeFilePathURL} from '@/util/file-url'
import {Image} from 'expo-image'
import {iconMeta, type IconType} from '../icon.constants-gen'
import type {getAssetPath as getAssetPathType} from '@/constants/platform'
import type * as React from 'react'
import type * as T from '@/constants/types'

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

// ── Placeholder img-set resolution ───────────────────────────────────────────

type MultMap = {
  [1]?: number
  [2]?: number
  [3]?: number
}

const multiKeys = [1, 2, 3] as const

const idealSizeMultMap: {[key: string]: MultMap} = {
  '128': {'1': 256, '2': 256, '3': 960},
  '16': {'1': 192, '2': 192, '3': 192},
  '32': {'1': 192, '2': 192, '3': 192},
  '48': {'1': 192, '2': 192, '3': 192},
  '64': {'1': 192, '2': 256, '3': 192},
  '96': {'1': 192, '2': 192, '3': 960},
}

const _getMultsMapCache: {[key: string]: MultMap} = {}
function getMultsMap(imgMap: {[size: string]: unknown}, targetSize: number): MultMap {
  const ssizes = Object.keys(imgMap)
  if (!ssizes.length) return {}

  const sizeKey = `${targetSize}]${ssizes.join(':')}`
  if (_getMultsMapCache[sizeKey]) return _getMultsMapCache[sizeKey]

  const sizes = ssizes.map(s => parseInt(s, 10)).sort((a: number, b: number) => a - b)
  const multsMap: MultMap = {1: undefined, 2: undefined, 3: undefined}

  for (const mult of multiKeys) {
    const level1 = idealSizeMultMap[String(targetSize)]
    if (level1) {
      const level2 = level1[mult]
      if (level2) {
        multsMap[mult] = level2
        continue
      }
    }
    const ideal = mult * targetSize
    const size = sizes.find(size => size >= ideal)
    multsMap[mult] = size || sizes.at(-1)
  }

  _getMultsMapCache[sizeKey] = multsMap
  return multsMap
}

function iconTypeToImgSetDesktop(imgMap: {[key: string]: IconType}, targetSize: number) {
  const {getAssetPath} = require('@/constants/platform') as {getAssetPath: typeof getAssetPathType}
  const multsMap = getMultsMap(imgMap, targetSize)
  const keys = Object.keys(multsMap) as unknown as Array<keyof typeof multsMap>
  const sets = keys
    .map(mult => {
      const m = multsMap[mult]
      if (!m) return null
      const img: string = imgMap[m] as string
      if (!img) return null
      const url = getAssetPath('images', 'icons', img)
      return `url('${url}.png') ${mult}x`
    })
    .filter(Boolean)
    .join(', ')
  return sets ? `-webkit-image-set(${sets})` : ''
}

function iconTypeToImgSetNative(imgMap: {[key: string]: IconType}, targetSize: number) {
  const multsMap = getMultsMap(imgMap, targetSize)
  const idealMults = [2, 3, 1] as const
  for (const mult of idealMults) {
    if (multsMap[mult]) {
      const size = multsMap[mult]
      if (!size) return null
      const icon = imgMap[size]
      if (!icon) return null
      return iconMeta[icon].require
    }
  }
  return null
}

const iconTypeToImgSet: (imgMap: {[key: string]: IconType}, targetSize: number) => string = (
  isMobile ? iconTypeToImgSetNative : iconTypeToImgSetDesktop
) as any

// ── Native-only ──────────────────────────────────────────────────────────────

const sizeToTeamBorderRadius: Record<number, number> = {
  128: 12, 16: 4, 24: 4, 32: 5, 48: 6, 64: 8, 96: 10,
}

type SizeStyle = {container: {height: number; width: number}; image: {borderRadius: number; height: number; overflow: 'hidden'; width: number}}
const allSizes = [16, 24, 32, 48, 64, 96, 128] as const
const styleCache = new Map<string, SizeStyle>()
for (const size of allSizes) {
  for (const isTeam of [true, false]) {
    const br = isTeam ? (sizeToTeamBorderRadius[size] ?? size / 2) : size / 2
    styleCache.set(`${size}-${isTeam}`, {
      container: {height: size, width: size},
      image: {borderRadius: br, height: size, overflow: 'hidden', width: size},
    })
  }
}

const bgColor = Styles.globalColors.greyLight
const errorUnderlay = {backgroundColor: bgColor, position: 'absolute'} as const

// ── Desktop-only ─────────────────────────────────────────────────────────────

const AVATAR_CONTAINER_SIZE = 175
const AVATAR_BORDER_SIZE = 4
const AVATAR_SIZE = AVATAR_CONTAINER_SIZE - AVATAR_BORDER_SIZE * 2

const clickableStyle = {cursor: 'pointer'} as const
const borderTeamStyle = {
  boxShadow: `0px 0px 0px 1px ${Styles.globalColors.black_10} inset`,
} satisfies React.CSSProperties

// ── Component ────────────────────────────────────────────────────────────────

function Avatar(p: Props) {
  const {size, teamname, username, isTeam: _isTeam, onClick: _onClick, style, children} = p
  const {imageOverrideUrl, crop} = p
  const isTeam = _isTeam || !!teamname
  const name = isTeam ? teamname : username
  const counter = AvatarZus.useAvatarState(s => s.counts.get(name || '') ?? 0)
  const httpSrv = useConfigState(s => s.httpSrv)
  const isDarkMode = useColorScheme() === 'dark'
  const {address, token} = httpSrv
  const [errorUri, setErrorUri] = useState<string>()

  const onClick =
    _onClick === 'profile' ? (username ? () => navToProfile(username) : undefined) : _onClick

  if (!isMobile) {
    const avatarSizeClassName = `avatar-${isTeam ? 'team' : 'user'}-size-${size}`

    let bgImage: string | undefined
    if (imageOverrideUrl) {
      bgImage = `url("${normalizeFilePathURL(imageOverrideUrl)}")`
    } else if (address && name) {
      const typ = isTeam ? 'team' : 'user'
      const imgSize = size <= 64 ? 192 : size <= 96 ? 256 : 960
      bgImage = `url(http://${address}/av?typ=${typ}&name=${name}&format=square_${imgSize}&mode=light&token=${token}&count=${counter})`
    }

    const placeholderBg = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, size)
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
          {!!showBg && <div className="avatar-user-image" style={{backgroundImage: showBg}} />}
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

  const cached = styleCache.get(`${size}-${isTeam}`)!

  let source: {uri: string} | null = null
  if (imageOverrideUrl) {
    source = {uri: imageOverrideUrl}
  } else if (address && name) {
    const typ = isTeam ? 'team' : 'user'
    const mode = isDarkMode ? 'dark' : 'light'
    const imgSize = size <= 64 ? 192 : size <= 96 ? 256 : 960
    source = {uri: `http://${address}/av?typ=${typ}&name=${name}&format=square_${imgSize}&mode=${mode}&token=${token}&count=${counter}`}
  }

  const placeholderSource = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, size) as unknown as number
  const imgError = !!source && errorUri === source.uri
  const containerStyle = style ? Styles.collapseStyles([cached.container, style]) : cached.container

  const content = (
    <>
      {source ? (
        <>
          {imgError && <Image source={placeholderSource} style={[cached.image, errorUnderlay]} />}
          {/* recyclingKey must be the identity (name), not the uri: changing it blanks the view,
              and the uri churns when the local http srv hands out a new address/token on foreground.
              Keep this mounted on error: onError can fire for a stale load after the uri changes,
              so unmounting would hide a load that succeeds; the placeholder underlays real
              failures and onLoad clears the error. */}
          <Image
            source={source}
            style={cached.image}
            recyclingKey={name}
            cachePolicy="memory-disk"
            onError={() => setErrorUri(source.uri)}
            onLoad={() => setErrorUri(undefined)}
          />
        </>
      ) : (
        <Image source={placeholderSource} style={cached.image} />
      )}
      {children}
    </>
  )

  if (onClick) {
    return <Pressable onPress={onClick} style={containerStyle}>{content}</Pressable>
  }

  return <View style={containerStyle}>{content}</View>
}

export default Avatar
