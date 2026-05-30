import type * as T from '@/constants/types'
import {Box2, IconAuto, ImageIcon} from '@/common-adapters'
import type {IconType} from '@/common-adapters'

type Props = {
  platform: T.More.PlatformsExpandedType
  overlay: IconType
  overlayColor?: string
  style?: object
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

const platformSpecs = {
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
} as const

const getSpecForPlatform = (platform: T.More.PlatformsExpandedType): IconSpec => {
  return {...standardOffsets, ...platformSpecs[platform]}
}

const PlatformIcon = ({platform, overlay, style}: Props) => {
  const iconSpec = getSpecForPlatform(platform)
  return (
    <Box2 direction="vertical" relative={true} style={style}>
      <ImageIcon type={iconSpec.icon} />
      <IconAuto
        type={overlay}
        style={{
          bottom: iconSpec.offsetBottom,
          position: 'absolute',
          right: iconSpec.offsetRight,
        }}
      />
    </Box2>
  )
}

export default PlatformIcon
