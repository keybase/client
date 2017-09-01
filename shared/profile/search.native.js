// @flow
import * as React from 'react'
import ServiceFilter from '../search/services-filter'
import ResultsList from '../search/results-list/container'
import UserInput from '../search/user-input/container'
import {Box, ProgressIndicator, StandardScreen, Text} from '../common-adapters'
import {globalMargins, globalStyles} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <StandardScreen style={styleContainer} onCancel={props.onClose} title="Search people">
    <Box style={styleInput}>
      <UserInput searchKey="profileSearch" onExitSearch={props.onClose} />
    </Box>
    {props.showServiceFilter &&
      <Box style={styleSearchFilter}>
        <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">Filter:</Text>
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
      </Box>}
    <Box>
      {props.showSearchPending
        ? <Box style={styleSpinner}>
            <ProgressIndicator size="large" />
          </Box>
        : <ResultsList searchKey="profileSearch" onClick={props.onClick} disableListBuilding={true} />}
    </Box>
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

const styleSearchFilter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: globalMargins.tiny,
}

const styleSpinner = {
  paddingTop: globalMargins.small,
}

export default Search
