import {PlatformsExpandedType} from '../constants/types/more'
import {IconType} from '../common-adapters/icon.constants' // do NOT pull in all of common-adapters

const ProveMessages = {
  btc: 'Set a Bitcoin address',
  dns: 'Prove your website',
  dnsOrGenericWebSite: 'Prove your website',
  facebook: 'Prove your Facebook',
  github: 'Prove your GitHub',
  hackernews: 'Prove your Hacker News',
  http: 'Prove your HTTP website',
  https: 'Prove your HTTPS website',
  keybase: '',
  none: '',
  pgp: 'Add a PGP key',
  reddit: 'Prove your Reddit',
  rooter: 'Prove your Rooter',
  twitter: 'Prove your Twitter',
  web: 'Prove your website',
  zcash: 'Set a Zcash address',
}

export function proveMessage(platform: PlatformsExpandedType) {
  return ProveMessages[platform]
}

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

export type ServiceId =
  | 'email'
  | 'facebook'
  | 'github'
  | 'hackernews'
  | 'keybase'
  | 'pgp'
  | 'reddit'
  | 'twitter'

export function serviceIdToIcon(service: ServiceId): IconType {
  return ({
    email: 'iconfont-mention',
    facebook: 'iconfont-identity-facebook',
    github: 'iconfont-identity-github',
    hackernews: 'iconfont-identity-hn',
    keybase: 'iconfont-identity-devices',
    pgp: 'iconfont-identity-pgp',
    reddit: 'iconfont-identity-reddit',
    twitter: 'iconfont-identity-twitter',
  } as const)[service]
}

export function serviceIdToLogo24(service: ServiceId): IconType {
  return ({
    email: 'icon-keybase-logo-24',
    facebook: 'icon-facebook-logo-24',
    github: 'icon-github-logo-24',
    hackernews: 'icon-hacker-news-logo-24',
    keybase: 'icon-keybase-logo-24',
    pgp: 'icon-pgp-key-24',
    reddit: 'icon-reddit-logo-24',
    twitter: 'icon-twitter-logo-24',
  } as const)[service]
}

// a user id in the form of 'foo' if a keybase user
// or 'foobar@github' if another service
export type UserId = string

export function serviceIdFromString(val: string): ServiceId {
  switch (val) {
    case 'email':
    case 'facebook':
    case 'github':
    case 'hackernews':
    case 'keybase':
    case 'pgp':
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
