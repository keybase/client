// @flow
import React from 'react'
import type {IconType} from './icon'
import type {PlatformsExpandedType} from '../constants/types/more'
import Box from './box'
import Icon from './icon'
import {isMobile} from '../constants/platform'

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
  offsetBottom: isMobile ? -4 : -2,
  offsetRight: isMobile ? -1 : -5,
}

function _specsForMobileOrDesktop() {
  const size = isMobile ? 64 : 48
  return ({
    twitter: {icon: `icon-twitter-logo-${size}`},
    github: {icon: `icon-github-logo-${size}`},
    facebook: {icon: `icon-facebook-logo-${size}`},
    reddit: {icon: `icon-reddit-logo-${size}`},
    hackernews: {icon: `icon-hacker-news-logo-${size}`},
    dns: {icon: `icon-website-${size}`},
    http: {icon: `icon-website-${size}`},
    https: {icon: `icon-website-${size}`},
    dnsOrGenericWebSite: {icon: `icon-website-${size}`},
    rooter: {icon: `icon-website-${size}`},
    btc: {icon: `icon-bitcoin-logo-${size}`},
    zcash: {icon: `icon-zcash-logo-${size}`},
    pgp: {icon: `icon-pgp-key-${size}`, offsetBottom: -2, offsetRight: 4},
  }: any)
}

const getSpecForPlatform = (platform: PlatformsExpandedType): IconSpec => {
  const specs = _specsForMobileOrDesktop()
  return {...standardOffsets, ...specs[platform]}
}

const Render = ({platform, overlay, overlayColor, style}: Props) => {
  const iconSpec = getSpecForPlatform(platform)
  return (
    <Box style={{position: 'relative', ...style}}>
      <Icon type={iconSpec.icon} />
      <Icon
        type={overlay}
        style={{
          position: 'absolute',
          bottom: iconSpec.offsetBottom,
          right: iconSpec.offsetRight,
        }}
      />
    </Box>
  )
}

export default Render
