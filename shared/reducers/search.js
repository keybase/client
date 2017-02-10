// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/search'

import type {IconType} from '../common-adapters/icon'
import type {SearchResult, SearchActions, SearchPlatforms} from '../constants/search'

const {equalSearchResult, platformToNiceName} = Constants

export type State = {
  searchHintText: string,
  searchText: ?string,
  searchIcon: IconType,
  searchPlatform: SearchPlatforms,
  searchTextClearTrigger: number,
  results: Array<SearchResult>,
  requestTimestamp: ?Date,
  selectedUsers: Array<SearchResult>,
  userForInfoPane: ?SearchResult,
  showUserGroup: boolean,
  waiting: boolean,
}

const searchHintText = (searchPlatform: SearchPlatforms, selectedUsers: Array<SearchResult>): string => {
  const name = platformToNiceName(searchPlatform)
  return `${selectedUsers.length ? `Add a ${name} user` : `Search ${name}`}`
}

const showUserGroup = (searchText: ?string, selectedUsers: Array<SearchResult>): boolean => (
  !searchText && !!selectedUsers.length
)

const initialState: State = {
  searchHintText: searchHintText('Keybase', []),
  searchText: '',
  searchIcon: 'icon-keybase-logo-24',
  searchTextClearTrigger: 1,
  searchPlatform: 'Keybase',
  selectedUsers: [],
  results: [],
  requestTimestamp: null,
  userForInfoPane: null,
  showUserGroup: showUserGroup(null, []),
  waiting: false,
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
          showUserGroup: showUserGroup(action.payload.term, state.selectedUsers),
          searchPlatform: state.searchPlatform || initialState.searchPlatform,
          results: [],
        }
      }
      break
    case Constants.selectPlatform:
      if (!action.error) {
        const searchPlatform = action.payload.platform
        return {
          ...state,
          searchHintText: searchHintText(searchPlatform, state.selectedUsers),
          searchPlatform,
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
    case Constants.addUsersToGroup:
      if (!action.error) {
        const users = action.payload.users
        const maybeUpgradeUser = user => user.service === 'external' && user.keybaseSearchResult ? user.keybaseSearchResult : user
        const isNotSelected = user => state.selectedUsers.find(u => equalSearchResult(u, user)) === undefined
        const selectedUsers = users.map(maybeUpgradeUser).filter(isNotSelected).concat(state.selectedUsers)

        return {
          ...state,
          selectedUsers,
          showUserGroup: showUserGroup(null, selectedUsers),
          userForInfoPane: action.payload.users.length ? maybeUpgradeUser(action.payload.users[0]) : null,
          searchHintText: searchHintText(state.searchPlatform, selectedUsers),
          results: [],
          searchText: null,
          searchTextClearTrigger: state.searchTextClearTrigger + 1,
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
        const idx = state.selectedUsers.indexOf(user)
        if (idx !== -1) {
          const selectedUsers: Array<SearchResult> = state.selectedUsers.concat([])
          selectedUsers.splice(idx, 1)
          let userForInfoPane = state.userForInfoPane

          // find a new selection if we just removed the selected user
          if (user === userForInfoPane) {
            userForInfoPane = selectedUsers.length > idx ? selectedUsers[idx] : null
          }

          return {
            ...state,
            showUserGroup: showUserGroup(null, selectedUsers),
            selectedUsers,
            userForInfoPane,
          }
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
    case Constants.reset:
      return {
        ...initialState,
        searchIcon: state.searchIcon,
        searchPlatform: state.searchPlatform,
        showUserGroup: showUserGroup(null, []),
      }
    case Constants.waiting:
      return {
        ...state,
        waiting: action.payload && action.payload.waiting,
      }
  }

  return state
}
