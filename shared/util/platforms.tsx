import {PlatformsExpandedType} from '../constants/types/more'
import {IconType} from '../common-adapters/icon.constants-gen' // do NOT pull in all of common-adapters

export function subtitle(platform: PlatformsExpandedType): string | null {
  switch (platform) {
    case 'zcash':
    case 'btc':
      return null
    case 'dns':
    case 'http':
    case 'https':
    case 'web':
      return platform
    default:
      return `@${platform}`
  }
}

export type ServiceId = 'facebook' | 'github' | 'hackernews' | 'keybase' | 'reddit' | 'twitter'

export function serviceIdToIcon(service: ServiceId): IconType {
  return ({
    facebook: Kb.IconType.iconfont_identity_facebook,
    github: Kb.IconType.iconfont_identity_github,
    hackernews: Kb.IconType.iconfont_identity_hn,
    keybase: Kb.IconType.iconfont_identity_devices,
    reddit: Kb.IconType.iconfont_identity_reddit,
    twitter: Kb.IconType.iconfont_identity_twitter,
  } as const)[service]
}

export function serviceIdToLogo24(service: ServiceId): IconType {
  return ({
    facebook: Kb.IconType.icon_facebook_logo_24,
    github: Kb.IconType.icon_github_logo_24,
    hackernews: Kb.IconType.icon_hacker_news_logo_24,
    keybase: Kb.IconType.icon_keybase_logo_24,
    reddit: Kb.IconType.icon_reddit_logo_24,
    twitter: Kb.IconType.icon_twitter_logo_24,
  } as const)[service]
}

// a user id in the form of 'foo' if a keybase user
// or 'foobar@github' if another service
export type UserId = string

export function serviceIdFromString(val: string): ServiceId {
  switch (val) {
    case 'facebook':
    case 'github':
    case 'hackernews':
    case 'keybase':
    case 'reddit':
    case 'twitter':
      return val
    default:
      return 'keybase'
  }
}

export function parseUserId(
  id: UserId
): {
  username: string
  serviceId: ServiceId
} {
  // This regex matches [THING1]@THING2 where THING1 cannot contain [] and THING2 cannot contain []@
  const matches = /^\[([^[\]]+)\]@([^@[\]]+)$/.exec(id)
  if (matches) {
    return {
      serviceId: serviceIdFromString(matches[2]),
      username: matches[1],
    }
  }
  const [username, maybeServiceId] = id.split('@')
  const serviceId = serviceIdFromString(maybeServiceId)
  return {
    serviceId,
    username,
  }
}
