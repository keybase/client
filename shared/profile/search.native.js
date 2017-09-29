// @flow
import * as React from 'react'
import ResultsList from '../search/results-list/container'
import UserInput from '../search/user-input/container'
import {Box, StandardScreen} from '../common-adapters'
import {globalMargins, globalStyles} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <StandardScreen style={styleContainer} onCancel={props.onClose} title="Search people">
    <Box style={styleInput}>
      <UserInput
        searchKey="profileSearch"
        onExitSearch={props.onClose}
        autoFocus={true}
        placeholder={props.placeholder}
      />
    </Box>
    <ResultsList searchKey="profileSearch" onClick={props.onClick} disableListBuilding={true} />
  </StandardScreen>
)

const styleInput = {
  flexGrow: 1,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  paddingTop: globalMargins.small,
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  // StandardScreen supplies padding we don't want.
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
}

export default Search
