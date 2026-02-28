import type * as T from '@/constants/types'
import type {IconType} from '@/common-adapters/icon.constants-gen' // do NOT pull in all of common-adapters

export function subtitle(platform: T.More.PlatformsExpandedType): string {
  switch (platform) {
    case 'zcash':
    case 'btc':
      return ''
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
