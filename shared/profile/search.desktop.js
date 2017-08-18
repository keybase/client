// @flow
import * as React from 'react';
import ServiceFilter from '../search/services-filter'
import ResultsList from '../search/results-list'
import UserInput from '../search/user-input'
import {Box, Icon, ProgressIndicator, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './search'

const Search = (props: Props) => (
  <Box style={styleCatcher} onClick={props.onClose}>
    <Box style={styleSearchContainer} onClick={e => e.stopPropagation()}>
      <Box style={styleSearchRow}>
        <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
          <Box style={{flexGrow: 1, paddingLeft: globalMargins.small}}>
            <UserInput
              ref={props.setInputRef}
              autoFocus={true}
              onChangeText={props.onChangeText}
              onClickAddButton={props.onClickAddButton}
              onAddSelectedUser={props.onAddSelectedUser}
              onMoveSelectUp={props.onMoveSelectUp}
              onMoveSelectDown={props.onMoveSelectDown}
              onRemoveUser={props.onRemoveUser}
              placeholder={props.placeholder}
              userItems={props.userItems}
              usernameText={props.searchText}
              onCancel={props.onClose}
            />
          </Box>
          <Box style={{marginTop: globalMargins.small}}>
            <Icon style={styleSearchIcon} type="iconfont-close" onClick={props.onClose} />
          </Box>
        </Box>
      </Box>
      {props.showServiceFilter &&
        <Box style={styleServiceRow}>
          <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">Filter:</Text>
          <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
        </Box>}
      <Box style={{...styleSearchRow, ...globalStyles.scrollable, justifyContent: 'center'}}>
        {props.showSearchPending
          ? <Box style={styleSpinner}>
              <ProgressIndicator style={{width: globalMargins.large}} />
            </Box>
          : <ResultsList
              items={props.searchResultIds}
              onClick={props.onClick}
              onMouseOver={props.onMouseOverSearchResult}
              selectedId={props.selectedSearchId}
              showSearchSuggestions={props.showSearchSuggestions}
            />}
      </Box>
    </Box>
  </Box>
)

const styleCatcher = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.transparent,
  height: '100%',
  position: 'absolute',
  width: '100%',
  zIndex: 20,
}

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

const styleServiceRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleSpinner = {
  alignSelf: 'center',
  height: 256,
  marginTop: globalMargins.small,
}

export default Search
