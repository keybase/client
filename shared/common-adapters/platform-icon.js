// @flow
import React from 'react'
import type {IconType} from './icon'
import type {PlatformsExpandedType} from '../constants/types/more'
import {Box, Icon} from '../common-adapters'

type Props = {
  platform: PlatformsExpandedType,
  overlay: IconType,
  overlayColor?: string,
  style?: Object,
}

type IconSpec = {
  icon: IconType,
  offsetBottom: number,
  offsetRight: number,
}

const standardOffsets = {
  offsetBottom: -2,
  offsetRight: -5,
}

const getSpecForPlatform = (platform: PlatformsExpandedType): IconSpec => {
  const specs = {
    'coinbase': {icon: 'icon-coinbase-logo-48'},
    'twitter': {icon: 'icon-twitter-logo-48'},
    'github': {icon: 'icon-github-logo-48'},
    'facebook': {icon: 'icon-facebook-logo-48'},
    'reddit': {icon: 'icon-reddit-logo-48'},
    'hackernews': {icon: 'icon-hacker-news-logo-48'},
    'dns': {icon: 'icon-website-48'},
    'http': {icon: 'icon-website-48'},
    'https': {icon: 'icon-website-48'},
    'dnsOrGenericWebSite': {icon: 'icon-website-48'},
    'rooter': {icon: 'icon-website-48'},
    'btc': {icon: 'icon-bitcoin-logo-48'},
    'zcash': {icon: 'icon-zcash-logo-48'},
    'pgp': {icon: 'icon-pgp-key-48', offsetBottom: -2, offsetRight: 4},
  }
  return {...standardOffsets, ...specs[platform]}
}

const Render = ({platform, overlay, overlayColor, style}: Props) => {
  const iconSpec = getSpecForPlatform(platform)
  return (
    <Box style={{position: 'relative', ...style}}>
      <Icon type={iconSpec.icon} />
      <Icon type={overlay} style={{color: overlayColor, position: 'absolute', bottom: iconSpec.offsetBottom, right: iconSpec.offsetRight}} />
    </Box>
  )
}

export default Render
