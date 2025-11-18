import type * as T from '@/constants/types'
import Box from './box'
import Icon, {type IconType} from './icon'

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
  offsetBottom: C.isMobile ? -4 : -2,
  offsetRight: C.isMobile ? -1 : -5,
}

function _specsForMobileOrDesktop() {
  return {
    btc: {icon: C.isMobile ? 'icon-bitcoin-logo-64' : 'icon-bitcoin-logo-48'},
    dns: {icon: C.isMobile ? 'icon-website-64' : 'icon-website-48'},
    dnsOrGenericWebSite: {icon: C.isMobile ? 'icon-website-64' : 'icon-website-48'},
    facebook: {icon: C.isMobile ? 'icon-facebook-logo-64' : 'icon-facebook-logo-48'},
    github: {icon: C.isMobile ? 'icon-github-logo-64' : 'icon-github-logo-48'},
    hackernews: {icon: C.isMobile ? 'icon-hacker-news-logo-64' : 'icon-hacker-news-logo-48'},
    http: {icon: C.isMobile ? 'icon-website-64' : 'icon-website-48'},
    https: {icon: C.isMobile ? 'icon-website-64' : 'icon-website-48'},
    pgp: {icon: C.isMobile ? 'icon-pgp-key-64' : 'icon-pgp-key-48', offsetBottom: -2, offsetRight: 4},
    reddit: {icon: C.isMobile ? 'icon-reddit-logo-64' : 'icon-reddit-logo-48'},
    rooter: {icon: C.isMobile ? 'icon-website-64' : 'icon-website-48'},
    twitter: {icon: C.isMobile ? 'icon-twitter-logo-64' : 'icon-twitter-logo-48'},
    web: {icon: C.isMobile ? 'icon-website-64' : 'icon-website-48'},
    zcash: {icon: C.isMobile ? 'icon-zcash-logo-64' : 'icon-zcash-logo-48'},
  } as const
}

const getSpecForPlatform = (platform: T.More.PlatformsExpandedType): IconSpec => {
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
