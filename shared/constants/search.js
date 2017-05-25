// @flow
import type {IconType} from '../common-adapters/icon'
import type {TypedAction} from '../constants/types/flux'
import type {OnClickFollowers, OnClickFollowing, OnClickAvatar} from './profile'
import type {StartConversation} from './chat'

export type SearchPlatforms = 'Keybase' | 'Twitter' | 'Github' | 'Reddit' | 'Hackernews' | 'Pgp' | 'Facebook'

export type ExtraInfo =
  | {
      service: 'external',
      icon: ?IconType,
      serviceUsername: string, // i.e. with twitter it would be malgorithms
      serviceAvatar: string, // i.e. with twitter it would be their twitter avatar url
      fullNameOnService: string, // Say with twitter we know malgorithms is "Chris Coyne"
    }
  | {
      service: 'keybase',
      username: string,
      fullName: string,
      isFollowing: boolean,
    }
  | {
      service: 'none',
      fullName: string,
    }

export type SearchResult =
  | {|
      service: 'keybase',
      username: string,
      isFollowing: boolean,
      extraInfo: ExtraInfo,
    |}
  | {|
      service: 'external',
      icon: IconType,
      username: string,
      serviceName: SearchPlatforms,
      serviceAvatar: string, // i.e. with twitter it would be their twitter avatar url
      profileUrl: string,
      extraInfo: ExtraInfo,
      keybaseSearchResult: ?SearchResult, // If we want to grab the keybase version of a search result
    |}

// Keys for service+username to use in cross referencing things
export function searchResultKeys(result: SearchResult): Array<string> {
  const results = []
  if (result.service === 'keybase') {
    results.push('Keybase' + result.username)
  } else if (result.service === 'external') {
    if (result.keybaseSearchResult) {
      results.push('Keybase' + result.keybaseSearchResult.username)
    }
    results.push(result.serviceName + result.username)
  }

  return results
}

export function fullName(extraInfo: ExtraInfo): string {
  switch (extraInfo.service) {
    case 'keybase':
    case 'none':
      return extraInfo.fullName
    case 'external':
      return extraInfo.fullNameOnService
  }
  return ''
}

export function searchResultToAssertion(r: SearchResult): string {
  if (r.service === 'external') {
    return `${r.username}@${r.serviceName.toLowerCase()}`
  }

  return r.username
}

export const search = 'search:search'
export type Search = TypedAction<'search:search', {term: string}, void>

export const results = 'search:results'
export type Results = TypedAction<
  'search:results',
  {term: string, results: Array<SearchResult>, requestTimestamp: Date},
  void
>

export const selectPlatform = 'search:selectPlatform'
export type SelectPlatform = TypedAction<'search:selectPlatform', {platform: SearchPlatforms}, void>

export const selectUserForInfo = 'search:selectUserForInfo'
export type SelectUserForInfo = TypedAction<'search:selectUserForInfo', {user: SearchResult}, void>

export const addUsersToGroup = 'search:addUsersToGroup'
export type AddUsersToGroup = TypedAction<'search:addUsersToGroup', {users: Array<SearchResult>}, void>

export const removeUserFromGroup = 'search:removeUserFromGroup'
export type RemoveUserFromGroup = TypedAction<'search:removeUserFromGroup', {user: SearchResult}, void>

export const toggleUserGroup = 'search:toggleUserGroup'
export type ToggleUserGroup = TypedAction<'search:toggleUserGroup', {show: boolean}, void>

export const reset = 'search:reset'
export type Reset = TypedAction<'search:reset', {}, void>

export const waiting = 'search:waiting'
export type Waiting = TypedAction<'search:waiting', {waiting: boolean}, void>

export type Actions =
  | Search
  | Results
  | SelectPlatform
  | SelectUserForInfo
  | AddUsersToGroup
  | RemoveUserFromGroup
  | ToggleUserGroup
  | Reset
  | Waiting
  | OnClickFollowers
  | OnClickFollowing
  | OnClickAvatar
  | StartConversation

export function platformToIcon(platform: SearchPlatforms): IconType {
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

export function platformToLogo32(platform: SearchPlatforms): IconType {
  return {
    Keybase: 'icon-keybase-logo-32',
    Twitter: 'icon-twitter-logo-32',
    Github: 'icon-github-logo-32',
    Reddit: 'icon-reddit-logo-32',
    Hackernews: 'icon-hacker-news-logo-32',
    Pgp: 'icon-pgp-key-32',
    Facebook: 'icon-facebook-logo-32',
  }[platform]
}

export function platformToLogo24(platform: SearchPlatforms): IconType {
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

export function platformToLogo16(platform: SearchPlatforms): IconType {
  return {
    Keybase: 'icon-keybase-logo-16',
    Twitter: 'icon-twitter-logo-16',
    Github: 'icon-github-logo-16',
    Reddit: 'icon-reddit-logo-16',
    Hackernews: 'icon-hacker-news-logo-16',
    Pgp: 'icon-pgp-key-16',
    Facebook: 'icon-facebook-logo-16',
  }[platform]
}

export function platformToNiceName(platform: SearchPlatforms): string {
  const niceNames: {[key: SearchPlatforms]: ?string} = {
    Hackernews: 'Hacker News',
  }

  return niceNames[platform] || platform
}

export function equalSearchResult(a: SearchResult, b: SearchResult): boolean {
  return a.service === b.service && a.username === b.username
}

export type State = {
  requestTimestamp: ?Date,
  results: Array<SearchResult>,
  searchHintText: string,
  searchIcon: IconType,
  searchPlatform: SearchPlatforms,
  searchText: ?string,
  searchTextClearTrigger: number,
  selectedUsers: Array<SearchResult>,
  showUserGroup: boolean,
  userForInfoPane: ?SearchResult,
  waiting: boolean,
}
