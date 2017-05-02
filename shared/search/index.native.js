// @flow
import React from 'react'
import {Box, HeaderHoc} from '../common-adapters/index'
import SearchBar from './user-search/search-bar'
import UserGroup from './user-search/user-group'
import UserSearch from './user-search/render'
import {globalStyles} from '../styles'
import {compose, withProps} from 'recompose'
import {Keyboard} from 'react-native'

import type {Props} from '.'
import type {Props as UserSearchProps} from './user-search/render'
import type {Props as UserGroupProps} from './user-search/user-group'
import type {Props as SearchBarProps} from './user-search/search-bar'

const SearchRender = (props: Props) => {
  const userSearchProps: UserSearchProps = props
  const userGroupProps: UserGroupProps = props
  const searchBarProps: SearchBarProps = props

  return (
    <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <SearchBar {...searchBarProps} />
        {props.showUserGroup ? <UserGroup {...userGroupProps} /> : <UserSearch {...userSearchProps} />}
      </Box>
    </Box>
  )
}

export default compose(
  withProps(ownProps => ({
    headerStyle: {
      borderBottomWidth: 0,
    },
    onCancel: () => {
      ownProps.onReset()
      Keyboard.dismiss()
    },
  })),
  HeaderHoc,
)(SearchRender)
