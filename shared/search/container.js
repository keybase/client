// @flow
import React, {Component} from 'react'
import Render from './'
import UserPane from './user-pane'
import {HOCForm} from '../common-adapters'
import {TypedConnector} from '../util/typed-connect'
import {isMobile} from '../constants/platform'
import {openInKBFS} from '../actions/kbfs'
import {privateFolderWithUsers, publicFolderWithUsers} from '../constants/config'
import {routeAppend} from '../actions/router'
import {search, selectPlatform, addUserToGroup, removeUserFromGroup, selectUserForInfo, hideUserGroup, reset} from '../actions/search'
import {searchResultToAssertion} from '../constants/search'

import type {TypedState} from '../constants/reducer'
import type {FSOpen} from '../constants/kbfs'
import type {Props} from './'
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

const connector: TypedConnector<TypedState, TypedDispatch<SearchActions | FSOpen>, OwnProps, Props> = new TypedConnector()

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
     onClickUserInGroup: user => { dispatch(isMobile ? routeAppend({path: 'profile', userOverride: {username: user.username}}) : selectUserForInfo(user)) },
     onReset: () => { dispatch(reset()) },
     onAddAnotherUserToGroup: () => { dispatch(hideUserGroup()) },
     onOpenPrivateGroupFolder: () => { username && dispatch(openInKBFS(privateFolderWithUsers(selectedUsers.map(searchResultToAssertion).concat(username)))) },
     onOpenPublicGroupFolder: () => { username && dispatch(openInKBFS(publicFolderWithUsers(selectedUsers.map(searchResultToAssertion)))) },
     onGroupChat: () => { console.log('TODO open group chat') },
     chatEnabled: false,
   }))(HOCForm(Search, {valueName: 'searchText', updateValueName: 'onSearch', updateValueDebounce: 500}))
