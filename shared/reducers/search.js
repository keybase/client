// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/search'

const searchHintText = (
  searchPlatform: Constants.SearchPlatforms,
  selectedUsers: Array<Constants.SearchResult>
): string => {
  const name = Constants.platformToNiceName(searchPlatform)
  return `${selectedUsers.length ? `Add a ${name} user` : `Search ${name}`}`
}

const showUserGroup = (
  searchText: ?string,
  selectedUsers: Array<Constants.SearchResult>
): boolean => !searchText && !!selectedUsers.length

const initialState: Constants.State = {
  requestTimestamp: null,
  results: [],
  searchHintText: searchHintText('Keybase', []),
  searchIcon: 'icon-keybase-logo-24',
  searchPlatform: 'Keybase',
  searchText: '',
  searchTextClearTrigger: 1,
  selectedUsers: [],
  showUserGroup: showUserGroup(null, []),
  userForInfoPane: null,
  waiting: false,
}

export default function(
  state: Constants.State = initialState,
  action: Constants.Actions
): Constants.State {
  if (action.type === CommonConstants.resetStore) {
    return {...initialState}
  }

  switch (action.type) {
    case Constants.search:
      if (!action.error) {
        return {
          ...state,
          results: [],
          searchPlatform: state.searchPlatform || initialState.searchPlatform,
          searchText: action.payload.term,
          showUserGroup: showUserGroup(action.payload.term, state.selectedUsers),
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
        const maybeUpgradeUser = user =>
          user.service === 'external' && user.keybaseSearchResult ? user.keybaseSearchResult : user
        const isNotSelected = user =>
          state.selectedUsers.find(u => Constants.equalSearchResult(u, user)) === undefined
        const selectedUsers = users
          .map(maybeUpgradeUser)
          .filter(isNotSelected)
          .concat(state.selectedUsers)

        return {
          ...state,
          results: [],
          searchHintText: searchHintText(state.searchPlatform, selectedUsers),
          searchText: null,
          searchTextClearTrigger: state.searchTextClearTrigger + 1,
          selectedUsers,
          showUserGroup: showUserGroup(null, selectedUsers),
          userForInfoPane: action.payload.users.length
            ? maybeUpgradeUser(action.payload.users[0])
            : null,
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
          const selectedUsers: Array<Constants.SearchResult> = state.selectedUsers.concat([])
          selectedUsers.splice(idx, 1)
          let userForInfoPane = state.userForInfoPane

          // find a new selection if we just removed the selected user
          if (user === userForInfoPane) {
            userForInfoPane = selectedUsers.length > idx ? selectedUsers[idx] : null
          }

          return {
            ...state,
            selectedUsers,
            showUserGroup: showUserGroup(null, selectedUsers),
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
          requestTimestamp: action.payload.requestTimestamp,
          results: action.payload.results,
        }
      }
      break
    case Constants.reset:
      return {
        ...initialState,
        searchTextClearTrigger: state.searchTextClearTrigger + 1,
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
