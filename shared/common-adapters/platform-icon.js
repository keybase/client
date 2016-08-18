// @flow
import React from 'react'
import type {IconType} from './icon'
import type {PlatformsExpandedType} from '../constants/types/more'
import {Box, Icon} from '../common-adapters'

type Props = {
  platform: PlatformsExpandedType,
  size: 48,
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

const getSpecForPlatform = (platform: PlatformsExpandedType): {[size: string]: IconSpec} => {
  const specs = {
    'coinbase': {
      '48': {icon: 'icon-coinbase-logo-48', ...standardOffsets},
    },
    'twitter': {
      '48': {icon: 'icon-twitter-logo-48', ...standardOffsets},
    },
    'github': {
      '48': {icon: 'icon-github-logo-48', ...standardOffsets},
    },
    'reddit': {
      '48': {icon: 'icon-reddit-logo-48', ...standardOffsets},
    },
    'hackernews': {
      '48': {icon: 'icon-hacker-news-logo-48', ...standardOffsets},
    },
    'dns': {
      '48': {icon: 'icon-website-48', ...standardOffsets},
    },
    'http': {
      '48': {icon: 'icon-website-48', ...standardOffsets},
    },
    'https': {
      '48': {icon: 'icon-website-48', ...standardOffsets},
    },
    'dnsOrGenericWebSite': {
      '48': {icon: 'icon-website-48', ...standardOffsets},
    },
    'rooter': {
      '48': {icon: 'icon-website-48', ...standardOffsets},
    },
    'btc': {
      '48': {icon: 'icon-bitcoin-logo-48', ...standardOffsets},
    },
    'pgp': {
      '48': {icon: 'icon-pgp-key-48', offsetBottom: -2, offsetRight: 4},
    },
  }
  return specs[platform]
}

const Render = ({platform, overlay, overlayColor, size, style}: Props) => {
  const iconSpec = getSpecForPlatform(platform)[String(size)]

  if (!iconSpec) {
    console.warn(`Unsupported platform and size pair: ${platform} @ ${size}`)
    return null
  }

  return (
    <Box style={{position: 'relative', ...style}}>
      <Icon type={iconSpec.icon} />
      <Icon type={overlay} style={{color: overlayColor, position: 'absolute', bottom: iconSpec.offsetBottom, right: iconSpec.offsetRight}} />
    </Box>
  )
}

export default Render
