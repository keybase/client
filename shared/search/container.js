// @flow
import React from 'react'
import Search from '.'
import UserPane from './user-pane'
import {connect} from 'react-redux'
import {isMobile} from '../constants/platform'
import {navigateAppend} from '../actions/route-tree'
import {openInKBFS} from '../actions/kbfs'
import {privateFolderWithUsers, publicFolderWithUsers} from '../constants/config'
import {
  search,
  selectPlatform,
  addUsersToGroup,
  removeUserFromGroup,
  selectUserForInfo,
  hideUserGroup,
  reset,
} from '../actions/search'
import {searchResultToAssertion} from '../constants/search'
import {startConversation} from '../actions/chat'

import type {TypedState} from '../constants/reducer'
import type {Props} from '.'

type OwnProps = {}

const mapStateToProps = (state: TypedState) => {
  const {
    waiting,
    searchHintText,
    searchPlatform: selectedService,
    searchText,
    searchIcon,
    results,
    userForInfoPane,
    showUserGroup,
    selectedUsers,
    searchTextClearTrigger,
  } = state.search
  const {username} = state.config

  return {
    results,
    searchHintText,
    searchIcon,
    searchText,
    searchTextClearTrigger,
    selectedService,
    selectedUsers,
    showUserGroup,
    userForInfoPane,
    userPane: <UserPane />,
    username: username || '',
    waiting,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onAddAnotherUserToGroup: () => dispatch(hideUserGroup()),
  onClickResult: user => dispatch(addUsersToGroup([user])),
  onClickService: (platform, searchPlatform) => {
    if (searchPlatform !== platform) {
      dispatch(selectPlatform(platform))
    }
  },
  onClickUserInGroup: user =>
    dispatch(
      isMobile
        ? navigateAppend([{props: {username: user.username}, selected: 'profile'}])
        : selectUserForInfo(user)
    ),
  onGroupChat: (username, selectedUsers) => {
    dispatch(reset())
    dispatch(startConversation(selectedUsers.map(searchResultToAssertion).concat(username || '')))
  },
  onOpenPrivateGroupFolder: (username, selectedUsers) => {
    if (username) {
      dispatch(reset())
      dispatch(
        openInKBFS(privateFolderWithUsers(selectedUsers.map(searchResultToAssertion).concat(username)))
      )
    }
  },
  onOpenPublicGroupFolder: (username, selectedUsers) => {
    if (username) {
      dispatch(reset())
      dispatch(openInKBFS(publicFolderWithUsers(selectedUsers.map(searchResultToAssertion))))
    }
  },
  onRemoveUserFromGroup: user => dispatch(removeUserFromGroup(user)),
  onReset: () => dispatch(reset()),
  onSearch: (term, selectedPlatform, searchPlatform) =>
    dispatch(search(term, selectedPlatform || searchPlatform)),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps): Props => ({
  ...stateProps,
  ...dispatchProps,
  ...ownProps,
  onClickService: platform => dispatchProps.onClickService(platform, stateProps.selectedService),
  onGroupChat: () => dispatchProps.onGroupChat(stateProps.username, stateProps.selectedUsers),
  onOpenPrivateGroupFolder: () =>
    dispatchProps.onOpenPrivateGroupFolder(stateProps.username, stateProps.selectedUsers),
  onOpenPublicGroupFolder: () =>
    dispatchProps.onOpenPublicGroupFolder(stateProps.username, stateProps.selectedUsers),
  onSearch: (term, selectedPlatform) =>
    dispatchProps.onSearch(term, selectedPlatform, stateProps.searchPlatform),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Search)
