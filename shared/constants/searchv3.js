// @flow
import {List, Record} from 'immutable'

import type {NoErrorTypedAction} from '../constants/types/flux'
import type {IconType} from '../common-adapters/icon'

const services: {[service: string]: true} = {
  Facebook: true,
  GitHub: true,
  'Hacker News': true,
  Keybase: true,
  Reddit: true,
  Twitter: true,
}

export type Service = $Keys<typeof services>

export type FollowingState = 'Following' | 'NotFollowing' | 'NoState' | 'You'

export type SearchPlatform = 'Keybase' | 'Twitter' | 'Github' | 'Reddit' | 'Hackernews' | 'Pgp' | 'Facebook'

export type SearchResultId = string
export type SearchQuery = string

export type RowProps = {|
  id: SearchResultId,

  leftFollowingState: FollowingState,
  leftIcon: ?IconType, // If service is keybase this can be null
  leftService: Service,
  leftUsername: string,

  rightFollowingState: FollowingState,
  rightFullname: ?string,
  rightIcon: ?IconType,
  rightService: ?Service,
  rightUsername: ?string,

  showTrackerButton: boolean,
|}

export type SearchResult = {|
  id: SearchResultId,

  leftIcon: ?IconType, // If service is keybase this can be null
  leftService: Service,
  leftUsername: string,

  rightFullname: ?string,
  rightIcon: ?IconType,
  rightService: ?Service,
  rightUsername: ?string,
|}

// Keypaths - maybe these should be somewhere else?
export type KeyPath = ['searchv3Chat'] | ['searchv3Profile']

export type SearchType = 'Profile' | 'Chat'

// Actions
export type Search<TypeToFire> = NoErrorTypedAction<
  'searchv3:search',
  {term: string, service: SearchPlatform, actionTypeToFire: TypeToFire}
>

export type FinishedSearch<TypeToFire> = NoErrorTypedAction<
  TypeToFire,
  {searchResults: List<SearchResultId>, searchTerm: string, service: SearchPlatform}
>

export type OnShowTracker = NoErrorTypedAction<'searchv3:onShowTracker', {resultId: string, keyPath: KeyPath}>

// Generic so others can make their own version
export type UpdateSearchResultsGeneric<T> = NoErrorTypedAction<T, {searchResults: List<SearchResultId>}>

// Platform icons
function platformToIcon(platform: SearchPlatform): IconType {
  return {
    Keybase: 'iconfont-identity-devices',
    Twitter: 'iconfont-identity-twitter',
    Github: 'iconfont-identity-github',
    Reddit: 'iconfont-identity-reddit',
    Hackernews: 'iconfont-identity-hn',
    Pgp: 'iconfont-identity-pgp',
    Facebook: 'iconfont-identity-facebook',
  }[platform]
}

function platformToLogo24(platform: SearchPlatform): IconType {
  return {
    Keybase: 'icon-keybase-logo-24',
    Twitter: 'icon-twitter-logo-24',
    Github: 'icon-github-logo-24',
    Reddit: 'icon-reddit-logo-24',
    Hackernews: 'icon-hacker-news-logo-24',
    Pgp: 'icon-pgp-key-24',
    Facebook: 'icon-facebook-logo-24',
  }[platform]
}

// Parse fns

function toSearchQuery(serviceName: string, searchTerm: string): SearchQuery {
  return `${serviceName}-${searchTerm}`
}

export type SearchSubState = Record<{|
  results: List<SearchResultId>,
  selected: SearchResultId,
  typing: boolean,
|}>

export type State = Record<{|
  // TODO selected, typing, etc
  // A list of queries that have been searched and cachedk
  searchCache: List<SearchQuery>,
  chat: SearchSubState,
  profile: SearchSubState,
|}>

const StateRecord = Record({
  searchCache: new List(),
  chat: new List(),
  profileResults: new List(),
})

export {StateRecord, toSearchQuery, platformToIcon, platformToLogo24}
