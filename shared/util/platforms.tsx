import type {PlatformsExpandedType} from '../constants/types/more'
import type {IconType} from '../common-adapters/icon.constants-gen' // do NOT pull in all of common-adapters

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
  return (
    {
      facebook: 'iconfont-identity-facebook',
      github: 'iconfont-identity-github',
      hackernews: 'iconfont-identity-hn',
      keybase: 'iconfont-identity-devices',
      reddit: 'iconfont-identity-reddit',
      twitter: 'iconfont-identity-twitter',
    } as const
  )[service]
}

export function serviceIdToLogo24(service: ServiceId): IconType {
  return (
    {
      facebook: 'icon-facebook-logo-24',
      github: 'icon-github-logo-24',
      hackernews: 'icon-hacker-news-logo-24',
      keybase: 'icon-keybase-logo-24',
      reddit: 'icon-reddit-logo-24',
      twitter: 'icon-twitter-logo-24',
    } as const
  )[service]
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

export function parseUserId(id: UserId): {
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
