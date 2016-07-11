/* @flow */
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import SearchHelp from './help.desktop'
import {globalStyles, globalColors} from '../styles/style-guide'
import UserSearch from './user-search/render.desktop'
import UserGroup from './user-search/user-group'
import SearchBar from './user-search/search-bar.desktop'
import UserPane from './user-pane'

import type {Props} from './render'
import type {Props as UserSearchProps} from './user-search/render'
import type {Props as UserGroupProps} from './user-search/user-group'
import type {Props as SearchBarProps} from './user-search/search-bar'

const ClearSearch = ({onReset, showUserGroup}) => (
  <Box style={{...globalStyles.flexBoxColumn, height: 48, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 16}}>
    {showUserGroup && <Text type='BodySmallSecondaryLink' onClick={onReset}>Clear search</Text>}
  </Box>
)

class Render extends Component<void, Props, void> {
  _renderComingSoon () {
    return <SearchHelp username={this.props.username} />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    const userSearchProps: UserSearchProps = this.props
    const userGroupProps: UserGroupProps = this.props
    const searchBarProps: SearchBarProps = this.props

    return (
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
          <ClearSearch {...this.props} />
          <SearchBar {...searchBarProps} />
          <Box style={{overflowY: 'auto', height: 'calc(100% - 96px)'}}>
            {this.props.showUserGroup ? <UserGroup {...userGroupProps} /> : <UserSearch {...userSearchProps} />}
          </Box>
        </Box>
        <Box style={{boxShadow: `0 0 5px ${globalColors.black_20}`, overflow: 'hidden'}}>
          <UserPane userForInfoPane={this.props.userForInfoPane} />
        </Box>
      </Box>
    )
  }
}

export default Render
