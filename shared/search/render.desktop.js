/* @flow */
import React, {Component} from 'react'
import {Box} from '../common-adapters'
import SearchHelp from './help.desktop'
import {globalStyles, globalColors} from '../styles/style-guide'
import {SearchContainer, SearchBar, searchResultsList} from './user-search/render.desktop'
import UserGroup from './user-search/user-group'
import UserPane from './user-pane'

import type {Props} from './render'

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <SearchHelp username={this.props.username} />
  }

  _renderInfoPane () {
    return (
      <Box style={{boxShadow: `0 0 5px ${globalColors.black_20}`, overflow: 'hidden'}}>
        <UserPane />
      </Box>
    )
  }

  _renderSearchResultsOrGroupAdd () {
    if (this.props.showUserGroup) {
      return (
        <UserGroup
          users={this.props.selectedUsers}
          onRemoveUser={this.props.onRemoveUserFromGroup}
          onClickUser={this.props.onClickUserInGroup}
          onOpenPrivateGroupFolder={this.props.onOpenPrivateGroupFolder}
          onOpenPublicGroupFolder={this.props.onOpenPublicGroupFolder}
          onGroupChat={this.props.onGroupChat}
          chatEnabled={this.props.chatEnabled} />
      )
    } else {
      return searchResultsList(this.props)
    }
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    return (
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <SearchContainer>
          <SearchBar
            onClickService={this.props.onClickService}
            onSearch={this.props.onSearch}
            searchHintText={this.props.searchHintText}
            searchText={this.props.searchText}
            selectedService={this.props.selectedService} />
          {this._renderSearchResultsOrGroupAdd()}
        </SearchContainer>
        {this._renderInfoPane()}
      </Box>
    )
  }
}

export default Render
