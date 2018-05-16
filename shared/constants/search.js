// @flow
import * as I from 'immutable'
import * as Types from './types/search'
import * as SearchGen from '../actions/search-gen'
import {amIFollowing, usernameSelector} from './selectors'
import type {IconType} from '../common-adapters'
import {createSelector} from 'reselect'
import type {TypedState} from './reducer'

export const makeSearchResult: I.RecordFactory<Types.SearchResult> = I.Record({
  id: '',
  leftFullname: null,
  leftIcon: null,
  leftService: 'Keybase',
  leftUsername: '',

  rightIcon: null,
  rightService: null,
  rightUsername: null,
})

function serviceIdToService(serviceId: string): Types.Service {
  return {
    keybase: 'Keybase',
    twitter: 'Twitter',
    github: 'GitHub',
    reddit: 'Reddit',
    hackernews: 'Hacker News',
    facebook: 'Facebook',
  }[serviceId]
}

function followStateHelper(state: TypedState, username: string, service: Types.Service) {
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
  id: Types.SearchResultId
): Types.SearchResultId {
  const searchResult = searchResultMap.get(id)
  if (searchResult) {
    if (searchResult.leftService === 'Keybase') {
      return searchResult.leftUsername
    } else if (searchResult.rightService === 'Keybase') {
      return searchResult.rightUsername || id
    }
  }

  return id
}

function platformToLogo24(service: Types.Service): IconType {
  return {
    Keybase: 'icon-keybase-logo-24',
    Twitter: 'icon-twitter-logo-24',
    GitHub: 'icon-github-logo-24',
    Reddit: 'icon-reddit-logo-24',
    'Hacker News': 'icon-hacker-news-logo-24',
    Pgp: 'icon-pgp-key-24',
    Facebook: 'icon-facebook-logo-24',
  }[service]
}

const isUserInputItemsUpdated = (searchKey: string) => (action: any) =>
  action.type === SearchGen.userInputItemsUpdated && action.payload && action.payload.searchKey === searchKey

const _getSearchResultIds = ({entities}: TypedState, {searchKey}: {searchKey: string}) =>
  entities.getIn(['search', 'searchKeyToResults', searchKey])

const getSearchResultIdsArray = createSelector(_getSearchResultIds, ids => ids && ids.toArray())

const getUserInputItemIdsOrderedSet = ({entities}: TypedState, {searchKey}: {searchKey: string}) =>
  entities.getIn(['search', 'searchKeyToUserInputItemIds', searchKey], I.OrderedSet())
const getUserInputItemIds = createSelector(getUserInputItemIdsOrderedSet, ids => ids && ids.toArray())

const getClearSearchTextInput = ({entities}: TypedState, {searchKey}: {searchKey: string}) =>
  entities.getIn(['search', 'searchKeyToClearSearchTextInput', searchKey], 0)

export {
  serviceIdToService,
  followStateHelper,
  maybeUpgradeSearchResultIdToKeybaseId,
  platformToLogo24,
  getClearSearchTextInput,
  getSearchResultIdsArray,
  getUserInputItemIds,
  isUserInputItemsUpdated,
}
