// Minimal fast Avatar (native).
import {useState} from 'react'
import * as Styles from '@/styles'
import {useConfigState} from '@/stores/config'
import * as AvatarZus from './avatar/store'
import {Image} from 'expo-image'
import {Pressable, View} from 'react-native'
import {useColorScheme} from 'react-native'
import {navToProfile} from '@/constants/router'
import {iconTypeToImgSet, type IconType} from './icon'
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

const sizeToTeamBorderRadius: Record<number, number> = {
  128: 12, 16: 4, 24: 4, 32: 5, 48: 6, 64: 8, 96: 10,
}

// Pre-compute all possible container+image style combos (size x isTeam)
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

function Avatar2(p: Props) {
  const {size, teamname, username, isTeam: _isTeam, onClick: _onClick, style, children} = p
  const {imageOverrideUrl} = p
  const isTeam = _isTeam || !!teamname
  const name = isTeam ? teamname : username
  const counter = AvatarZus.useAvatarState(s => s.counts.get(name || '') ?? 0)
  const httpSrv = useConfigState(s => s.httpSrv)
  const isDarkMode = useColorScheme() === 'dark'
  const {address, token} = httpSrv

  const cached = styleCache.get(`${size}-${isTeam}`)!

  let source: {uri: string} | null = null
  if (imageOverrideUrl) {
    source = {uri: imageOverrideUrl}
  } else if (address && name) {
    const typ = isTeam ? 'team' : 'user'
    const mode = isDarkMode ? 'dark' : 'light'
    const imgSize = size <= 64 ? 192 : size <= 96 ? 256 : 960
    source = {
      uri: `http://${address}/av?typ=${typ}&name=${name}&format=square_${imgSize}&mode=${mode}&token=${token}&count=${counter}`,
    }
  }

  // Placeholder source for error state
  const placeholderSource = iconTypeToImgSet(isTeam ? teamPlaceHolders : avatarPlaceHolders, size) as unknown as number

  const [errorUri, setErrorUri] = useState<string>()
  const imgError = !!source && errorUri === source.uri

  const onClick =
    _onClick === 'profile' ? (username ? () => navToProfile(username) : undefined) : _onClick

  const containerStyle = style ? Styles.collapseStyles([cached.container, style]) : cached.container
  const imageStyle = imgError ? Styles.collapseStyles([cached.image, {backgroundColor: bgColor}]) : cached.image

  const content = (
    <>
      {source && !imgError ? (
        <Image source={source} style={cached.image} onError={() => setErrorUri(source.uri)} />
      ) : (
        <Image source={placeholderSource} style={imageStyle} />
      )}
      {children}
    </>
  )

  if (onClick) {
    return (
      <Pressable onPress={onClick} style={containerStyle}>
        {content}
      </Pressable>
    )
  }

  return <View style={containerStyle}>{content}</View>
}

export default Avatar2
