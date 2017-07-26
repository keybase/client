// @flow
import {List} from 'immutable'
import {amIFollowing, usernameSelector} from './selectors'

import type {NoErrorTypedAction} from '../constants/types/flux'
import type {IconType} from '../common-adapters/icon'
import type {TypedState} from './reducer'

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

// This is what the api expects/returns
export type SearchPlatform = 'Keybase' | 'Twitter' | 'Github' | 'Reddit' | 'Hackernews' | 'Pgp' | 'Facebook'

export type SearchResultId = string // i.e. marcopolo or marcopolo@github
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
  onShowTracker: () => void,
  onClick: () => void,
  onMouseOver?: () => void,
  selected: boolean,
|}

// A normalized version of the row props above.
// The connector should fill in the missing pieces like the following state
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

// Actions
export type Search<TypeToFire> = NoErrorTypedAction<
  'searchv3:search',
  {term: string, service: Service, pendingActionTypeToFire: TypeToFire, finishedActionTypeToFire: TypeToFire}
>

export type SearchSuggestions<TypeToFire> = NoErrorTypedAction<
  'searchv3:searchSuggestions',
  {actionTypeToFire: TypeToFire, maxUsers: number}
>

export type PendingSearch<TypeToFire> = NoErrorTypedAction<TypeToFire, {pending: boolean}>

export type FinishedSearch<TypeToFire> = NoErrorTypedAction<
  TypeToFire,
  {searchResults: Array<SearchResultId>, searchResultTerm: string, service: Service}
>

// Generic so others can make their own version
export type UpdateSearchResultsGeneric<T> = NoErrorTypedAction<
  T,
  {searchResultTerm: string, searchResults: List<SearchResultId>, searchShowingSuggestions: boolean}
>
export type PendingSearchGeneric<T> = NoErrorTypedAction<T, boolean>

function serviceIdToService(serviceId: string): Service {
  return {
    keybase: 'Keybase',
    twitter: 'Twitter',
    github: 'GitHub',
    reddit: 'Reddit',
    hackernews: 'Hacker News',
    facebook: 'Facebook',
  }[serviceId]
}

function followStateHelper(state: TypedState, username: string, service: Service) {
  const me = usernameSelector(state)
  if (service === 'Keybase') {
    if (username === me) {
      return 'You'
    } else {
      return amIFollowing(state, username) ? 'Following' : 'NotFollowing'
    }
  }
  return 'NoState'
}

function maybeUpgradeSearchResultIdToKeybaseId(
  searchResultMap: $PropertyType<$PropertyType<TypedState, 'entities'>, 'searchResults'>,
  id: SearchResultId
): SearchResultId {
  if (!searchResultMap.get(id)) {
    console.warn('search result id not found in enitites.', id)
    return id
  }

  const searchResult = searchResultMap.get(id)
  if (searchResult.get('leftService') === 'Keybase') {
    return searchResult.get('leftUsername')
  } else if (searchResult.get('rightService') === 'Keybase') {
    return searchResult.get('rightUsername') || id
  }

  return id
}

export {serviceIdToService, followStateHelper, maybeUpgradeSearchResultIdToKeybaseId}
