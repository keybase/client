// @flow
import type {PlatformsExpandedType} from '../constants/types/more'

const FriendlyNames = {
  none: 'None',
  keybase: 'Keybase',
  twitter: 'Twitter',
  facebook: 'Facebook',
  github: 'GitHub',
  reddit: 'Reddit',
  hackernews: 'Hacker News',
  dnsOrGenericWebSite: 'Website',
  http: 'Website',
  https: 'Website',
  dns: 'DNS',
  pgp: 'PGP',
  rooter: 'Rooter',
  btc: 'Bitcoin',
  zcash: 'Zcash',
}

export function friendlyName(platform: PlatformsExpandedType) {
  return FriendlyNames[platform]
}

const ProveMessages = {
  none: '',
  keybase: '',
  twitter: 'Prove your Twitter',
  facebook: 'Prove your Facebook',
  github: 'Prove your GitHub',
  reddit: 'Prove your Reddit',
  hackernews: 'Prove your Hacker News',
  dnsOrGenericWebSite: 'Prove your website',
  http: 'Prove your website',
  https: 'Prove your website',
  dns: 'Prove your website',
  pgp: 'Add a PGP key',
  rooter: 'Prove your Rooter',
  btc: 'Set a Bitcoin address',
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
      return platform
    default:
      return `@${platform}`
  }
}

export type ServiceId = $Keys<typeof friendlyName>

export function serviceIdToIcon(service: ServiceId): IconType {
  return {
    keybase: 'iconfont-identity-devices',
    twitter: 'iconfont-identity-twitter',
    github: 'iconfont-identity-github',
    reddit: 'iconfont-identity-reddit',
    hackernews: 'iconfont-identity-hn',
    pgp: 'iconfont-identity-pgp',
    facebook: 'iconfont-identity-facebook',
  }[service]
}

export function serviceIdToLogo24(service: ServiceId): IconType {
  return {
    keybase: 'icon-keybase-logo-24',
    twitter: 'icon-twitter-logo-24',
    github: 'icon-github-logo-24',
    reddit: 'icon-reddit-logo-24',
    hackernews: 'icon-hacker-news-logo-24',
    pgp: 'icon-pgp-key-24',
    facebook: 'icon-facebook-logo-24',
  }[service]
}

// a user id in the form of 'foo' if a keybase user
// or 'foobar@github' if another service
export type UserId = string

export function parseUserId(id: UserId): {username: string, serviceId: ServiceId} {
  const [username, serviceId = 'keybase'] = id.split('@')
  return {
    username,
    serviceId,
  }
}
