// @flow
import React, {Component} from 'react'
import {isMobile} from '../constants/platform'
import {search, selectPlatform, addUserToGroup, removeUserFromGroup, selectUserForInfo, hideUserGroup, reset} from '../actions/search'
import Render from './render'
import {TypedConnector} from '../util/typed-connect'
import {searchResultToAssertion} from '../constants/search'
import {privateFolderWithUsers, publicFolderWithUsers} from '../constants/config'
import {openInKBFS} from '../actions/kbfs'
import {navigateAppend} from '../actions/route-tree'
import UserPane from './user-pane'

import type {TypedState} from '../constants/reducer'
import type {FSOpen} from '../constants/kbfs'
import type {NavigateAppend} from '../constants/route-tree'
import type {Props} from './render'
import type {SearchActions} from '../constants/search'
import type {TypedDispatch} from '../constants/types/flux'

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

const connector: TypedConnector<TypedState, TypedDispatch<SearchActions | FSOpen | NavigateAppend>, OwnProps, Props> = new TypedConnector()

export default connector.connect(
  ({search:
     {waiting, searchHintText, searchPlatform, searchText, searchIcon, results, userForInfoPane, showUserGroup, selectedUsers},
   config: {username}}, dispatch, ownProps) => ({
     username: username || '',
     userPane: <UserPane />,
     searchHintText,
     searchText,
     searchIcon,
     userForInfoPane,
     results,
     waiting,
     onClickResult: user => { dispatch(addUserToGroup(user)) },
     selectedService: searchPlatform,
     onSearch: (term, selectedPlatform) => { dispatch(search(term, selectedPlatform || searchPlatform)) },
     onClickService: platform => { searchPlatform !== platform && dispatch(selectPlatform(platform)) },
     showUserGroup,
     selectedUsers,
     onRemoveUserFromGroup: user => { dispatch(removeUserFromGroup(user)) },
     onClickUserInGroup: user => { dispatch(isMobile ? navigateAppend([{selected: 'profile', username: user.username}]) : selectUserForInfo(user)) },
     onReset: () => { dispatch(reset()) },
     onAddAnotherUserToGroup: () => { dispatch(hideUserGroup()) },
     onOpenPrivateGroupFolder: () => { username && dispatch(openInKBFS(privateFolderWithUsers(selectedUsers.map(searchResultToAssertion).concat(username)))) },
     onOpenPublicGroupFolder: () => { username && dispatch(openInKBFS(publicFolderWithUsers(selectedUsers.map(searchResultToAssertion)))) },
     onGroupChat: () => { console.log('TODO open group chat') },
     chatEnabled: false,
   }))(Search)
