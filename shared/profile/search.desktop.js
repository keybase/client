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
            userItems={props.userItems}
            onRemoveUser={props.onRemoveUser}
            onClickAddButton={props.onClickAddButton}
            placeholder={props.placeholder}
            usernameText={props.searchText}
            onChangeText={props.onChangeText}
            onMoveSelectUp={() => {}} // TODO
            onMoveSelectDown={() => {}} // TODO
            onEnter={() => {}} // TODO
          />
        </Box>
        <Icon style={styleSearchIcon} type="iconfont-close" onClick={props.onClose} />
      </Box>
    </Box>
    <Box style={{...styleSearchRow, justifyContent: 'center'}}>
      <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">Filter:</Text>
      <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
    </Box>
    <Box style={{...styleSearchRow, ...globalStyles.scrollable, justifyContent: 'center'}}>
      <ResultsList items={props.ids} onClick={props.onClick} selectedId={null} />
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
