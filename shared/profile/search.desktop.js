// @flow
import React from 'react'
import SearchResultsList from '../search/results-list/container'
import UserInput from '../search/user-input/container'
import {Box} from '../common-adapters'
import {globalStyles, globalColors, desktopStyles} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <Box style={styleCatcher} onClick={props.onClose}>
    <Box style={styleSearchContainer} onClick={e => e.stopPropagation()}>
      <Box style={styleSearchRow}>
        <UserInput
          disableListBuilding={true}
          searchKey="profileSearch"
          onSelectUser={props.onClick}
          onExitSearch={props.onClose}
          autoFocus={true}
          placeholder={props.placeholder}
        />
      </Box>
      <Box style={{...styleSearchRow, ...desktopStyles.scrollable, justifyContent: 'center'}}>
        <SearchResultsList searchKey="profileSearch" onClick={props.onClick} disableListBuilding={true} />
      </Box>
    </Box>
  </Box>
)

const styleSearchContainer = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderRadius: 5,
  boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
  flex: 1,
  minWidth: 400,
  position: 'absolute',
  top: 10,
  zIndex: 20,
}

const styleCatcher = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.transparent,
  height: '100%',
  position: 'absolute',
  width: '100%',
  zIndex: 20,
}

const styleSearchRow = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
}

export default Search
