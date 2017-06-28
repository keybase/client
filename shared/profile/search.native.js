// @flow
import React from 'react'
import ServiceFilter from '../searchv3/services-filter'
import ResultsList from '../searchv3/results-list'
import UserInput from '../searchv3/user-input'
import {Box, StandardScreen, Text} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <StandardScreen style={globalStyles.flexBoxColumn} onCancel={props.onClose} title="Search people">
    <Box style={{flexGrow: 1}}>
      <UserInput
        autoFocus={true}
        onChangeText={props.onChangeText}
        onClickAddButton={props.onClickAddButton}
        onEnter={props.onEnter}
        onMoveSelectUp={props.onMoveSelectUp}
        onMoveSelectDown={props.onMoveSelectDown}
        onRemoveUser={props.onRemoveUser}
        onUpdateSelectedSearchResult={props.onUpdateSelectedSearchResult}
        placeholder={props.placeholder}
        showAddButton={props.showAddButton}
        userItems={props.userItems}
        usernameText={props.searchText}
      />
    </Box>
    <Box style={styleSearchFilter}>
      <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">Filter:</Text>
      <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
    </Box>
    <Box>
      <ResultsList
        items={props.searchResultIds}
        onClick={props.onClick}
        selectedId={props.selectedSearchId}
      />
    </Box>
  </StandardScreen>
)

const styleSearchFilter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: globalMargins.tiny,
}

export default Search
