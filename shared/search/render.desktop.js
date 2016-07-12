/* @flow */
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
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
    return (
      <Box style={{overflowY: 'auto', height: 'calc(100% - 96px)'}}>
        {this.props.showUserGroup ? <UserGroup
          users={this.props.selectedUsers}
          userForInfoPane={this.props.userForInfoPane}
          onRemoveUser={this.props.onRemoveUserFromGroup}
          onClickUser={this.props.onClickUserInGroup}
          onOpenPrivateGroupFolder={this.props.onOpenPrivateGroupFolder}
          onOpenPublicGroupFolder={this.props.onOpenPublicGroupFolder}
          onGroupChat={this.props.onGroupChat}
          chatEnabled={this.props.chatEnabled} /> : searchResultsList(this.props)}
      </Box>
    )
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    return (
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <SearchContainer>
          <Box style={{...globalStyles.flexBoxColumn, height: 48, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 16}}>
            {this.props.showUserGroup && <Text type='BodySmallSecondaryLink' onClick={this.props.onReset}>Clear search</Text>}
          </Box>
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
