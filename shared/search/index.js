// @flow
import React, {Component} from 'react'
import {search, selectPlatform, addUserToGroup, removeUserFromGroup, selectUserForInfo, hideUserGroup} from '../actions/search'
import Render from './render'
import {TypedConnector} from '../util/typed-connect'

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
     onSearch: term => { dispatch(search(term, searchPlatform)); dispatch(hideUserGroup()) },
     onClickService: platform => { dispatch(selectPlatform(platform)) },
     showUserGroup,
     selectedUsers,
     onRemoveUserFromGroup: user => { dispatch(removeUserFromGroup(user)) },
     onClickUserInGroup: user => { dispatch(selectUserForInfo(user)) },
     onAddAnotherUserToGroup: () => { dispatch(hideUserGroup()) },
     onOpenPrivateGroupFolder: () => { console.log('TODO open private group') },
     onOpenPublicGroupFolder: () => { console.log('TODO open public group') },
     onGroupChat: () => { console.log('TODO open group chat') },
     chatEnabled: false,
   }))(Search)
