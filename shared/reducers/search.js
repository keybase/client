/* @flow */

import * as Constants from '../constants/search'
import * as CommonConstants from '../constants/common'
import type {IconType} from '../common-adapters/icon'
import {equalSearchResult} from '../constants/search'

import type {SearchResult, SearchActions, SearchPlatforms} from '../constants/search'

export type State = {
  searchHintText: string,
  searchText: ?string,
  searchIcon: IconType,
  searchPlatform: ?SearchPlatforms,
  results: Array<SearchResult>,
  requestTimestamp: ?Date,
  selectedUsers: Array<SearchResult>,
  userForInfoPane: ?SearchResult,
  showUserGroup: boolean,
}

const initialState: State = {
  searchHintText: 'Search for a user on Keybase',
  searchText: null,
  searchIcon: 'icon-keybase-logo-24',
  searchPlatform: 'Keybase',
  selectedUsers: [],
  results: [],
  requestTimestamp: null,
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
          results: [],
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
        const nextSelectedUsers = state.selectedUsers.filter(u => u !== user)
        return {
          ...state,
          showUserGroup: nextSelectedUsers.length === 0 ? false : state.showUserGroup,
          selectedUsers: nextSelectedUsers,
        }
      }
      break
    case Constants.results:
      if (!action.error) {
        if (action.payload.term !== state.searchText) {
          return state
        }

        if (state.requestTimestamp && action.payload.requestTimestamp < state.requestTimestamp) {
          return state
        }

        return {
          ...state,
          results: action.payload.results,
          requestTimestamp: action.payload.requestTimestamp,
        }
      }
      break
  }

  return state
}
