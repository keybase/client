// @flow
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import UserSearch from './user-search/render.desktop'
import UserGroup from './user-search/user-group'
import SearchBar from './user-search/search-bar'

import type {Props, RootProps} from '.'
import type {Props as UserSearchProps} from './user-search/render'
import type {Props as UserGroupProps} from './user-search/user-group'
import type {Props as SearchBarProps} from './user-search/search-bar'

const ClearSearch = ({onReset, showUserGroup}) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      height: 40,
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingRight: 16,
      flexShrink: 0,
    }}
  >
    {showUserGroup && <Text type="BodySmallSecondaryLink" onClick={onReset}>Clear search</Text>}
  </Box>
)

class SearchRender extends Component<void, Props, void> {
  render() {
    const userSearchProps: UserSearchProps = this.props
    const userGroupProps: UserGroupProps = this.props
    const searchBarProps: SearchBarProps = this.props
    const rootProps: RootProps = this.props
    const userPane = rootProps.userPane

    return (
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
          <ClearSearch {...this.props} />
          <SearchBar {...searchBarProps} />
          <Box style={{overflowY: 'auto', willChange: 'transform'}}>
            {this.props.showUserGroup
              ? <UserGroup {...userGroupProps} />
              : <UserSearch {...userSearchProps} />}
          </Box>
        </Box>
        <Box
          style={{
            boxShadow: `0 0 5px ${globalColors.black_20}`,
            overflow: 'hidden',
          }}
        >
          {userPane}
        </Box>
      </Box>
    )
  }
}

export default SearchRender
