/* @flow */

import React from 'react'
import {Box, Icon} from '../common-adapters'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {IconType} from './icon'
import type {Props} from './platform-icon'

const supportedPlatformsAndSizes: {[key: PlatformsExpandedType]: ?{[key: string]: ?IconType}} = {
  'coinbase': {
    '48': 'icon-coinbase-logo-48',
  },
  'twitter': {
    '48': 'icon-twitter-logo-48',
  },
  'github': {
    '48': 'icon-github-logo-48',
  },
  'reddit': {
    '48': 'icon-reddit-logo-48',
  },
  'hackernews': {
    '48': 'icon-hacker-news-logo-48',
  },
  'dns': {
    '48': 'icon-website-48',
  },
  'http': {
    '48': 'icon-website-48',
  },
  'https': {
    '48': 'icon-website-48',
  },
  'btc': {
    '48': 'icon-bitcoin-logo-48',
  },
}

const Render = ({platform, overlay, overlayColor, size}: Props) => {
  const icon: ?IconType = supportedPlatformsAndSizes[platform] && supportedPlatformsAndSizes[platform][String(size)]
  if (!icon) {
    console.warn('unsupported platform + size: ', platform, size)
    return null
  }

  return (
    <Box style={{position: 'relative'}}>
      <Icon type={icon} />
      <Box style={{position: 'absolute', bottom: 0, right: 0}}>
        <Icon type={overlay} style={{position: 'absolute', bottom: -2, right: -5}} />
      </Box>
    </Box>
  )
}

export default Render
