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
        userItems={props.userItems}
        showAddButton={props.showAddButton}
        onRemoveUser={props.onRemoveUser}
        onClickAddButton={props.onClickAddButton}
        placeholder={props.placeholder}
        usernameText={props.searchText}
        onChangeText={props.onChangeText}
      />
    </Box>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', justifyContent: 'center'}}>
      <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">Filter:</Text>
      <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
    </Box>
    <Box style={{...globalStyles.scrollable}}>
      <ResultsList items={props.ids} onClick={props.onClick} />
    </Box>
  </StandardScreen>
)

export default Search
