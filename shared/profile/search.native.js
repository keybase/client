// @flow
import React from 'react'
import ServiceFilter from '../searchv3/services-filter'
import ResultsList from '../searchv3/results-list'
import UserInput from '../searchv3/user-input'
import {Box, ProgressIndicator, StandardScreen, Text} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'

import type {Props} from './search'

const Search = (props: Props) =>
  <StandardScreen style={globalStyles.flexBoxColumn} onCancel={props.onClose} title="Search people">
    <Box style={{flexGrow: 1}}>
      <UserInput
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
        <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">
          Filter:
        </Text>
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
          />}
    </Box>
  </StandardScreen>

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
