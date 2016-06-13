// @flow

import type {Props as IconProps} from '../common-adapters/icon'
import type {TypedAction} from '../constants/types/flux'

export type ExtraInfo = {
  service: 'external',
  icon: IconProps.type,
  serviceUsername: string, // i.e. with twitter it would be malgorithms
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
  icon: IconProps.type,
  username: string,
  extraInfo: ExtraInfo
}

export const search = 'search:search'
export type Search = TypedAction<'search:search', {term: string}, void>

export const results = 'search:results'
export type Results = TypedAction<'search:results', {term: string, results: Array<SearchResult>}, void>

export type SearchActions = Search | Results
export type SearchPlatforms = 'Keybase' | 'Twitter' | 'Github' | 'Reddit' | 'Coinbase' | 'Hackernews'
