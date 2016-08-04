/* @flow */
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {Button} from '../common-adapters'
import UserSearch from './user-search/render'
import UserGroup from './user-search/user-group'
import type {Props} from './render'

import {fsList} from '../actions/kbfs'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    // For testing fs listing only, revert before PR merge
    const Connected = connect(state => ({}), dispatch => ({fsList: () => dispatch(fsList('/keybase/private/gabrielh/'))}))
      (props => <Button label='List /keybase' onClick={() => props.fsList()} type='Primary' />)
    return <Connected />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }
    if (this.props.showUserGroup) {
      return (
        <UserGroup
          selectedUsers={this.props.selectedUsers}
          userForInfoPane={this.props.userForInfoPane}
          onAddUser={this.props.onAddAnotherUserToGroup}
          onRemoveUserFromGroup={this.props.onRemoveUserFromGroup}
          onClickUserInGroup={this.props.onClickUserInGroup}
          onOpenPrivateGroupFolder={this.props.onOpenPrivateGroupFolder}
          onOpenPublicGroupFolder={this.props.onOpenPublicGroupFolder}
          onGroupChat={this.props.onGroupChat}
          chatEnabled={this.props.chatEnabled} />
      )
    } else {
      return (
        <UserSearch {...this.props} />
      )
    }
  }
}

export default Render
