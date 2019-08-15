import * as I from 'immutable'
import * as Types from './types/search'
import * as SearchGen from '../actions/search-gen'
import {IconType} from '../common-adapters/icon.constants' // do NOT pull in all of common-adapters
import {TypedState} from './reducer'

export const makeSearchResult = I.Record<Types.SearchResult>({
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
    // @ts-ignore
  return {
    facebook: 'Facebook',
    github: 'GitHub',
    hackernews: 'Hacker News',
    keybase: 'Keybase',
    reddit: 'Reddit',
    twitter: 'Twitter',
  }[serviceId]
}

function followStateHelper(state: TypedState, _username: string | null, _service: Types.Service | null) {
  const username = _username || ''
  const service = _service || ''
  const me = state.config.username
  if (service === 'Keybase') {
    if (username === me) {
      return 'You'
    } else {
      return state.config.following.has(username) ? 'Following' : 'NotFollowing'
    }
  }
  return 'NoState'
}

function maybeUpgradeSearchResultIdToKeybaseId(
  searchResultMap: I.Map<Types.SearchResultId, I.RecordOf<Types.SearchResult>>,
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
  return ({
    Facebook: 'icon-facebook-logo-24',
    GitHub: 'icon-github-logo-24',
    'Hacker News': 'icon-hacker-news-logo-24',
    Keybase: 'icon-keybase-logo-24',
    Pgp: 'icon-pgp-key-24',
    Reddit: 'icon-reddit-logo-24',
    Twitter: 'icon-twitter-logo-24',
  } as const)[service]
}

const isUserInputItemsUpdated = (searchKey: string) => (action: any) =>
  action.type === SearchGen.userInputItemsUpdated && action.payload && action.payload.searchKey === searchKey

const getSearchResultIds = (state: TypedState, searchKey: string): I.List<Types.SearchResultId> | null =>
  state.entities.getIn(['search', 'searchKeyToResults', searchKey])

const getUserInputItemIds = (state: TypedState, searchKey: string): I.OrderedSet<Types.SearchResultId> =>
  state.entities.search.searchKeyToUserInputItemIds.get(searchKey, I.OrderedSet())

const getClearSearchTextInput = ({entities}: TypedState, searchKey: string): number =>
  entities.search.searchKeyToClearSearchTextInput.get(searchKey, 0)

export {
  serviceIdToService,
  followStateHelper,
  maybeUpgradeSearchResultIdToKeybaseId,
  platformToLogo24,
  getClearSearchTextInput,
  getSearchResultIds,
  getUserInputItemIds,
  isUserInputItemsUpdated,
}
