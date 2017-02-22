// @flow
import React, {Component} from 'react'
import {Box} from '../common-adapters'
import SearchBar from './user-search/search-bar'
import UserGroup from './user-search/user-group'
import UserSearch from './user-search/render'
import {globalStyles} from '../styles'

import type {Props} from '.'
import type {Props as UserSearchProps} from './user-search/render'
import type {Props as UserGroupProps} from './user-search/user-group'
import type {Props as SearchBarProps} from './user-search/search-bar'

class SearchRender extends Component<void, Props, void> {
  render () {
    const userSearchProps: UserSearchProps = this.props
    const userGroupProps: UserGroupProps = this.props
    const searchBarProps: SearchBarProps = this.props

    return (
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
          <SearchBar {...searchBarProps} />
          {this.props.showUserGroup ? <UserGroup {...userGroupProps} /> : <UserSearch {...userSearchProps} />}
        </Box>
      </Box>
    )
  }
}

export default SearchRender
