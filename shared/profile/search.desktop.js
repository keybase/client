// @flow
import React from 'react'
import ServiceFilter from '../searchv3/services-filter'
import ResultsList from '../searchv3/results-list'
import UserInput from '../searchv3/user-input'
import {Box, Icon, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <Box style={styleSearchContainer}>
    <Box style={styleSearchRow}>
      <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
        <Box style={{flexGrow: 1, padding: globalMargins.small}}>
          <UserInput
            autoFocus={true}
            onChangeText={props.onChangeText}
            onClickAddButton={props.onClickAddButton}
            onAddSelectedUser={props.onAddSelectedUser}
            onMoveSelectUp={props.onMoveSelectUp}
            onMoveSelectDown={props.onMoveSelectDown}
            onRemoveUser={props.onRemoveUser}
            onUpdateSelectedSearchResult={props.onUpdateSelectedSearchResult}
            placeholder={props.placeholder}
            userItems={props.userItems}
            usernameText={props.usernameText}
          />
        </Box>
        <Icon style={styleSearchIcon} type="iconfont-close" onClick={props.onClose} />
      </Box>
    </Box>
    {props.showServiceFilter &&
      <Box style={{...styleSearchRow, justifyContent: 'center'}}>
        <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">Filter:</Text>
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
      </Box>}
    <Box style={{...styleSearchRow, ...globalStyles.scrollable, justifyContent: 'center'}}>
      <ResultsList
        items={props.searchResultIds}
        onClick={props.onClick}
        selectedId={props.selectedSearchId}
      />
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

const styleSearchIcon = {
  alignSelf: 'center',
  padding: globalMargins.small,
}

const styleSearchRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

export default Search
