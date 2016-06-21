// @flow

import type {IconType} from '../common-adapters/icon'
import type {TypedAction} from '../constants/types/flux'

export type ExtraInfo = {
  service: 'external',
  icon: IconType,
  serviceUsername: string, // i.e. with twitter it would be malgorithms
  serviceAvatar: ?string, // i.e. with twitter it would be their twitter avatar url
  fullNameOnService: ?string // Say with twitter we know malgorithms is "Chris Coyne"
} | {
  service: 'keybase',
  username: string,
  fullName: string,
  isFollowing: boolean
} | {
  service: 'none',
  fullName: string
}

export type SearchResult = {
  service: 'keybase',
  username: string,
  isFollowing: boolean,
  extraInfo: ExtraInfo
} | {
  service: 'external',
  icon: IconType,
  username: string,
  extraInfo: ExtraInfo
}

export const search = 'search:search'
export type Search = TypedAction<'search:search', {term: string}, void>

export const results = 'search:results'
export type Results = TypedAction<'search:results', {term: string, results: Array<SearchResult>}, void>

export type SearchPlatforms = 'Keybase' | 'Twitter' | 'Github' | 'Reddit' | 'Coinbase' | 'Hackernews' | 'Pgp'

export const selectPlatform = 'search:selectPlatform'
export type SelectPlatform = TypedAction<'search:selectPlatform', {platform: SearchPlatforms}, void>

export type SearchActions = Search | Results | SelectPlatform

export function platformToIcon (platform: SearchPlatforms): IconType {
  return {
    'Keybase': 'fa-kb-iconfont-identity-devices',
    'Twitter': 'fa-kb-iconfont-identity-twitter',
    'Github': 'fa-kb-iconfont-identity-github',
    'Reddit': 'fa-kb-iconfont-identity-reddit',
    'Coinbase': 'fa-kb-iconfont-identity-bitcoin',
    'Hackernews': 'fa-kb-iconfont-identity-hn',
    'Pgp': 'fa-kb-iconfont-identity-pgp',
  }[platform]
}

// TODO(mm) get Logo for Hn at 32x32
export function platformToLogo32 (platform: SearchPlatforms): IconType {
  return {
    'Keybase': 'keybase-logo-mascot-only-dz-2-32',
    'Twitter': 'icon-twitter-logo-32',
    'Github': 'icon-github-logo-32',
    'Reddit': 'icon-reddit-logo-32',
    'Coinbase': 'icon-coinbase-logo-32',
    'Hackernews': 'placeholder-avatar-32-x-32',
    'Pgp': 'icon-pgp-key-32',
  }[platform]
}
