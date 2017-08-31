// @flow
import React from 'react'
import SearchResultsList from '../search/results-list/container'
import UserInput from '../search/user-input/container.js'
import {Box} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <Box style={styleCatcher} onClick={props.onClose}>
    <Box style={styleSearchContainer} onClick={e => e.stopPropagation()}>
      <Box style={styleSearchRow}>
        <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
          <Box style={{flexGrow: 1, paddingLeft: globalMargins.small}}>
            <UserInput searchKey="profileSearch" onExitSearch={props.onClose} />
          </Box>
        </Box>
      </Box>
      <Box style={{...styleSearchRow, ...globalStyles.scrollable, justifyContent: 'center'}}>
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
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

export default Search
