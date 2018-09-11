// @flow strict
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'

export type ServiceIdWithContact =
  | 'facebook'
  | 'github'
  | 'hackernews'
  | 'keybase'
  | 'pgp'
  | 'reddit'
  | 'twitter'
  | 'contact'

export type SearchString = string
type UsernameOnService = string
export type UserID = string // for keybase would be `marcopolo` for other services would be `notonkb@reddit`
type KeybaseUserID = string

export type User = {
  serviceMap: I.Map<ServiceIdWithContact, UsernameOnService>,
  id: UserID,
  keybaseUserID: ?KeybaseUserID,
  prettyName: string,
}

// Treating this as a tuple
export type SearchKey = I.List<SearchString | ServiceIdWithContact>
// This is what should be kept in the reducer
// Keyed so that we never get results that don't match the user's input (e.g. outdated results)
export type SearchResults = I.Map<SearchKey, Array<User>>
export type ServiceResultCount = I.Map<SearchString, I.Map<ServiceIdWithContact, number>>

// Sagas can handle a cache if we want, this shouldn't be in the reducer.
export interface SearchCache {
  hasSearchQuery(search: SearchString, service: ServiceIdWithContact): boolean;
  getSearchCache(search: SearchString, service: ServiceIdWithContact): Array<UserID>;
  getUserInfo(id: UserID): ?User;
  getUsersInfo(ids: Array<UserID>): Array<?User>;
  addSearchResult(searchQuery: SearchString, service: ServiceIdWithContact, results: Array<User>): void;
}

export interface ServiceResultCountCache {
  hasSearchQuery(search: SearchString): boolean;
  getCache(search: SearchString): ?{[key: string]: number};
  addSearchResult(searchQuery: SearchString, counts: {[key: string]: number}): void;
}
