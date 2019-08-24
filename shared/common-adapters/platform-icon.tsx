import * as React from 'react'
import {PlatformsExpandedType} from '../constants/types/more'
import Box from './box'
import Icon, {IconType} from './icon'
import {isMobile} from '../constants/platform'

type Props = {
  platform: PlatformsExpandedType
  overlay: IconType
  overlayColor?: string
  style?: Object
}

type IconSpec = {
  icon: IconType
  offsetBottom: number
  offsetRight: number
}

const standardOffsets = {
  offsetBottom: isMobile ? -4 : -2,
  offsetRight: isMobile ? -1 : -5,
}

function _specsForMobileOrDesktop() {
  return {
    btc: {icon: isMobile ? 'icon-bitcoin-logo-64' : 'icon-bitcoin-logo-48'},
    dns: {icon: isMobile ? 'icon-website-64' : 'icon-website-48'},
    dnsOrGenericWebSite: {icon: isMobile ? 'icon-website-64' : 'icon-website-48'},
    facebook: {icon: isMobile ? 'icon-facebook-logo-64' : 'icon-facebook-logo-48'},
    github: {icon: isMobile ? 'icon-github-logo-64' : 'icon-github-logo-48'},
    hackernews: {icon: isMobile ? 'icon-hacker-news-logo-64' : 'icon-hacker-news-logo-48'},
    http: {icon: isMobile ? 'icon-website-64' : 'icon-website-48'},
    https: {icon: isMobile ? 'icon-website-64' : 'icon-website-48'},
    pgp: {icon: isMobile ? 'icon-pgp-key-64' : 'icon-pgp-key-48', offsetBottom: -2, offsetRight: 4},
    reddit: {icon: isMobile ? 'icon-reddit-logo-64' : 'icon-reddit-logo-48'},
    rooter: {icon: isMobile ? 'icon-website-64' : 'icon-website-48'},
    twitter: {icon: isMobile ? 'icon-twitter-logo-64' : 'icon-twitter-logo-48'},
    web: {icon: isMobile ? 'icon-website-64' : 'icon-website-48'},
    zcash: {icon: isMobile ? 'icon-zcash-logo-64' : 'icon-zcash-logo-48'},
  } as any
}

const getSpecForPlatform = (platform: PlatformsExpandedType): IconSpec => {
  const specs = _specsForMobileOrDesktop()
  return {...standardOffsets, ...specs[platform]}
}

const Render = ({platform, overlay, style}: Props) => {
  const iconSpec = getSpecForPlatform(platform)
  return (
    <Box style={{position: 'relative', ...style}}>
      <Icon type={iconSpec.icon} />
      <Icon
        type={overlay}
        style={{
          bottom: iconSpec.offsetBottom,
          position: 'absolute',
          right: iconSpec.offsetRight,
        }}
      />
    </Box>
  )
}

export default Render
