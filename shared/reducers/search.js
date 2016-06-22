/* @flow */

import * as Constants from '../constants/search'
import * as CommonConstants from '../constants/common'
import type {Props as IconProps} from '../common-adapters/icon'
import type {SearchResult, SearchActions, SearchPlatforms} from '../constants/search'

export type State = {
  searchHintText: string,
  searchText: string,
  searchIcon: IconProps.type,
  searchPlatform: SearchPlatforms,
  results: Array<SearchResult>,
  selectedUsers: Array<SearchResult>,
  userForInfoPane: ?SearchResult,
}

const initialState: State = {
  searchHintText: '',
  searchText: '',
  searchIcon: 'logo-24',
  searchPlatform: 'Keybase',
  selectedUsers: [],
  results: [],
  userForInfoPane: null,
}

export default function (state: State = initialState, action: SearchActions): State {
  if (action.type === CommonConstants.resetStore) {
    return {...initialState}
  }

  switch (action.type) {
    case Constants.search:
      if (!action.error) {
        return {
          ...state,
          searchText: action.payload.term,
          results: [],
        }
      }
      break
    case Constants.selectPlatform:
      if (!action.error) {
        return {
          ...state,
          searchPlatform: action.payload.platform,
        }
      }
      break
    case Constants.selectUserForInfo:
      if (!action.error) {
        return {
          ...state,
          userForInfoPane: action.payload.user,
        }
      }
      break
    case Constants.results:
      if (!action.error) {
        if (action.payload.term !== state.searchText) {
          return state
        }

        return {
          ...state,
          results: action.payload.results,
        }
      }
      break
  }

  return state
}
