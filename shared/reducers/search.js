/* @flow */

import * as Constants from '../constants/search'
import * as CommonConstants from '../constants/common'
import type {Props as IconProps} from '../common-adapters/icon'
import {equalSearchResult} from '../constants/search'

import type {SearchResult, SearchActions, SearchPlatforms} from '../constants/search'

export type State = {
  searchHintText: string,
  searchText: ?string,
  searchIcon: IconProps.type,
  searchPlatform: ?SearchPlatforms,
  results: Array<SearchResult>,
  selectedUsers: Array<SearchResult>,
  userForInfoPane: ?SearchResult,
  showUserGroup: boolean,
}

const initialState: State = {
  searchHintText: 'Search for a user on Keybase',
  searchText: null,
  searchIcon: 'logo-24',
  searchPlatform: 'Keybase',
  selectedUsers: [],
  results: [],
  userForInfoPane: null,
  showUserGroup: false,
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
          searchPlatform: state.searchPlatform || initialState.searchPlatform,
          results: [],
        }
      }
      break
    case Constants.selectPlatform:
      if (!action.error) {
        return {
          ...state,
          searchHintText: `Search for a user on ${action.payload.platform}`,
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
    case Constants.addUserToGroup:
      if (!action.error) {
        const user = action.payload.user
        // Try to upgrade an external search result into a keybase search result, won't work
        // if it's already a keybase search result or the user doesn't have a keybase account.
        const maybeUpgradedUser = user.service === 'external' && user.keybaseSearchResult ? user.keybaseSearchResult : user
        const alreadySelected = state.selectedUsers.find(u => equalSearchResult(u, maybeUpgradedUser)) !== undefined

        return {
          ...state,
          selectedUsers: alreadySelected
            ? state.selectedUsers
            : state.selectedUsers.concat(maybeUpgradedUser),
          showUserGroup: true,
          searchHintText: 'Search for another user',
          searchText: null,
          searchPlatform: null,
        }
      }
      break
    case Constants.toggleUserGroup:
      if (!action.error) {
        return {
          ...state,
          showUserGroup: action.payload.show,
        }
      }
      break
    case Constants.removeUserFromGroup:
      if (!action.error) {
        const user = action.payload.user
        return {
          ...state,
          selectedUsers: state.selectedUsers.filter(u => u !== user),
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
