// @flow
import type {PlatformsExpandedType} from '../constants/types/more'
import type {IconType} from '../common-adapters'

const ProveMessages = {
  btc: 'Set a Bitcoin address',
  dns: 'Prove your website',
  dnsOrGenericWebSite: 'Prove your website',
  facebook: 'Prove your Facebook',
  github: 'Prove your GitHub',
  hackernews: 'Prove your Hacker News',
  http: 'Prove your HTTP website',
  https: 'Prove your HTTPS website',
  web: 'Prove your website',
  keybase: '',
  none: '',
  pgp: 'Add a PGP key',
  reddit: 'Prove your Reddit',
  rooter: 'Prove your Rooter',
  twitter: 'Prove your Twitter',
  zcash: 'Set a Zcash address',
}

export function proveMessage(platform: PlatformsExpandedType) {
  return ProveMessages[platform]
}

export function subtitle(platform: PlatformsExpandedType): ?string {
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

export type ServiceId = 'facebook' | 'github' | 'hackernews' | 'keybase' | 'pgp' | 'reddit' | 'twitter'

export function serviceIdToIcon(service: ServiceId): IconType {
  return {
    facebook: 'iconfont-identity-facebook',
    github: 'iconfont-identity-github',
    hackernews: 'iconfont-identity-hn',
    keybase: 'iconfont-identity-devices',
    pgp: 'iconfont-identity-pgp',
    reddit: 'iconfont-identity-reddit',
    twitter: 'iconfont-identity-twitter',
  }[service]
}

export function serviceIdToLogo24(service: ServiceId): IconType {
  return {
    facebook: 'icon-facebook-logo-24',
    github: 'icon-github-logo-24',
    hackernews: 'icon-hacker-news-logo-24',
    keybase: 'icon-keybase-logo-24',
    pgp: 'icon-pgp-key-24',
    reddit: 'icon-reddit-logo-24',
    twitter: 'icon-twitter-logo-24',
  }[service]
}

// a user id in the form of 'foo' if a keybase user
// or 'foobar@github' if another service
export type UserId = string

export function parseUserId(id: UserId): {username: string, serviceId: ServiceId} {
  const [username, maybeServiceId] = id.split('@')
  let serviceId: ?ServiceId

  switch (maybeServiceId) {
    case 'facebook':
    case 'github':
    case 'hackernews':
    case 'keybase':
    case 'pgp':
    case 'reddit':
    case 'twitter':
      serviceId = maybeServiceId
      break
    default:
      serviceId = 'keybase'
  }

  return {
    serviceId,
    username,
  }
}
