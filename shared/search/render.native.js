/* @flow */
import React, {Component} from 'react'
import {ComingSoon} from '../common-adapters'
import UserSearch from './user-search/render'
import UserGroup from './user-search/user-group'
import type {Props} from './render'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }
    if (this.props.showUserGroup) {
      return (
        <UserGroup
          users={this.props.selectedUsers}
          onAddUser={this.props.onAddAnotherUserToGroup}
          onRemoveUser={this.props.onRemoveUserFromGroup}
          onClickUser={this.props.onClickUserInGroup}
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
