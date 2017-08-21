// @flow
import * as React from 'react'
import ServiceFilter from '../search/services-filter'
import ResultsList from '../search/results-list'
import UserInput from '../search/user-input'
import {Box, ProgressIndicator, StandardScreen, Text} from '../common-adapters'
import {globalMargins, globalStyles} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <StandardScreen style={styleContainer} onCancel={props.onClose} title="Search people">
    <Box style={styleInput}>
      <UserInput
        ref={props.setInputRef}
        autoFocus={true}
        onAddSelectedUser={props.onAddSelectedUser}
        onChangeText={props.onChangeText}
        onClickAddButton={props.onClickAddButton}
        onMoveSelectUp={props.onMoveSelectUp}
        onMoveSelectDown={props.onMoveSelectDown}
        onRemoveUser={props.onRemoveUser}
        placeholder={props.placeholder}
        userItems={props.userItems}
        usernameText={props.searchText}
      />
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
        : <ResultsList
            items={props.searchResultIds}
            onClick={props.onClick}
            selectedId={props.selectedSearchId}
            showSearchSuggestions={props.showSearchSuggestions}
          />}
    </Box>
  </StandardScreen>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  // StandardScreen supplies padding we don't want.
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
}

const styleInput = {
  flexGrow: 1,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  paddingTop: globalMargins.small,
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
