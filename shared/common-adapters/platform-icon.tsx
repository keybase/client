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
    btc: {icon: isMobile ? Kb.IconType.icon_bitcoin_logo_64 : Kb.IconType.icon_bitcoin_logo_48},
    dns: {icon: isMobile ? Kb.IconType.icon_website_64 : Kb.IconType.icon_website_48},
    dnsOrGenericWebSite: {icon: isMobile ? Kb.IconType.icon_website_64 : Kb.IconType.icon_website_48},
    facebook: {icon: isMobile ? Kb.IconType.icon_facebook_logo_64 : Kb.IconType.icon_facebook_logo_48},
    github: {icon: isMobile ? Kb.IconType.icon_github_logo_64 : Kb.IconType.icon_github_logo_48},
    hackernews: {
      icon: isMobile ? Kb.IconType.icon_hacker_news_logo_64 : Kb.IconType.icon_hacker_news_logo_48,
    },
    http: {icon: isMobile ? Kb.IconType.icon_website_64 : Kb.IconType.icon_website_48},
    https: {icon: isMobile ? Kb.IconType.icon_website_64 : Kb.IconType.icon_website_48},
    pgp: {
      icon: isMobile ? Kb.IconType.icon_pgp_key_64 : Kb.IconType.icon_pgp_key_48,
      offsetBottom: _2,
      offsetRight: 4,
    },
    reddit: {icon: isMobile ? Kb.IconType.icon_reddit_logo_64 : Kb.IconType.icon_reddit_logo_48},
    rooter: {icon: isMobile ? Kb.IconType.icon_website_64 : Kb.IconType.icon_website_48},
    twitter: {icon: isMobile ? Kb.IconType.icon_twitter_logo_64 : Kb.IconType.icon_twitter_logo_48},
    web: {icon: isMobile ? Kb.IconType.icon_website_64 : Kb.IconType.icon_website_48},
    zcash: {icon: isMobile ? Kb.IconType.icon_zcash_logo_64 : Kb.IconType.icon_zcash_logo_48},
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
