// @flow
import React from 'react'
import type {IconType} from './icon'
import type {Platforms} from '../constants/types/more'
import type {Props} from './platform-icon'
import {Box, Icon} from '../common-adapters'
import {globalColors} from '../styles/style-guide'

const supportedPlatformsAndSizes: {[key: Platforms | 'btc']: ?{[key: string]: ?IconType}} = {
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
  'genericWebSite': {
    '48': 'icon-website-48',
  },
  'dns': {
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

  // TODO switch with new assets from cecile. This is temp ( you can see through the checkmarks etc). remove white underlay
  return (
    <Box style={{position: 'relative'}}>
      <Icon type={icon} />
      <Box style={{position: 'absolute', bottom: 0, right: 0}}>
        <Icon type={overlay} style={{position: 'absolute', bottom: -3, right: -3, color: globalColors.white, fontSize: 30}} />
        <Icon type={overlay} style={{color: overlayColor}} />
      </Box>
    </Box>
  )
}

export default Render
