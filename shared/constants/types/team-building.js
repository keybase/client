// @flow
import * as I from 'immutable'
import type {ServiceId} from '../../util/platforms'

export type _State = {
  searchCache: SearchCache,
  searchQuery: ?SearchString,
  serviceResultCountCache: ServiceResultCountCache,
  teamSoFar: I.Set<UserID>,
}

export type SearchString = string
type UsernameOnService = string
export type UserID = string // for keybase would be `marcopolo` for other services would be `notonkb@reddit`
type KeybaseUserID = string

interface SearchCache {
  hasSearchQuery(search: SearchString): boolean;
  getSearchCache(search: SearchString): Array<UserID>;
  getUserInfo(id: UserID): ?User;
  getUsersInfo(ids: Array<UserID>): Array<?User>;
  addSearchResult(searchQuery: SearchString, results: Array<User>): void;
}

interface ServiceResultCountCache {
  hasSearchQuery(search: SearchString): boolean;
  getCache(search: SearchString): ?{[key: string]: number};
  addSearchResult(searchQuery: SearchString, counts: {[key: string]: number}): void;
}

export type User = {
  serviceMap: I.Map<ServiceId, UsernameOnService>,
  id: UserID,
  keybaseUserID: ?KeybaseUserID,
}

export type State = I.RecordOf<_State>
