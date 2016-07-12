// @flow
import React, {Component} from 'react'
import {isMobile} from '../constants/platform'
import {search, selectPlatform, addUserToGroup, removeUserFromGroup, selectUserForInfo, hideUserGroup} from '../actions/search'
import Render from './render'
import {TypedConnector} from '../util/typed-connect'
import {searchResultToAssertion} from '../constants/search'
import {privateFolderWithUsers, publicFolderWithUsers} from '../constants/config'
import {openInKBFS} from '../actions/kbfs'
import {routeAppend} from '../actions/router'

import type {TypedState} from '../constants/reducer'
import type {Props} from './render'
import type {SearchActions} from '../constants/search'
import type {TypedDispatch} from '../constants/types/flux'

import flags from '../util/feature-flags'

type OwnProps = {}

class Search extends Component<void, Props, void> {
  render () {
    return (
      <Render {...this.props} />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Search'},
    }
  }
}

const connector: TypedConnector<TypedState, TypedDispatch<SearchActions>, OwnProps, Props> = new TypedConnector()

export default connector.connect(
  ({search:
     {searchHintText, searchPlatform, searchText, searchIcon, results, userForInfoPane, showUserGroup, selectedUsers},
   config: {username}}, dispatch, ownProps) => ({
     username: username || '',
     searchHintText,
     searchText,
     searchIcon,
     userForInfoPane,
     results,
     showComingSoon: !flags.searchEnabled,
     onClickResult: user => { dispatch(addUserToGroup(user)) },
     selectedService: searchPlatform,
     onSearch: (term, selectedPlatform) => { dispatch(search(term, selectedPlatform || searchPlatform)); dispatch(hideUserGroup()) },
     onClickService: platform => { searchPlatform !== platform && dispatch(selectPlatform(platform)) },
     showUserGroup,
     selectedUsers,
     onRemoveUserFromGroup: user => { dispatch(removeUserFromGroup(user)) },
     onClickUserInGroup: user => { dispatch(isMobile ? routeAppend({path: 'profile', username: user.username}) : selectUserForInfo(user)) },
     onAddAnotherUserToGroup: () => { dispatch(hideUserGroup()) },
     onOpenPrivateGroupFolder: () => { username && dispatch(openInKBFS(privateFolderWithUsers(selectedUsers.map(searchResultToAssertion).concat(username)))) },
     onOpenPublicGroupFolder: () => { username && dispatch(openInKBFS(publicFolderWithUsers(selectedUsers.map(searchResultToAssertion)))) },
     onGroupChat: () => { console.log('TODO open group chat') },
     chatEnabled: false,
   }))(Search)
