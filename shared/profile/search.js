// @flow
import React from 'react'
import {onUserClick} from '../actions/profile'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/searchv3/creators'
import * as SearchConstants from '../constants/searchv3'
import {debounce} from 'lodash'
import ServiceFilter from '../searchv3/services-filter'
import ResultsList from '../searchv3/results-list'
import UserInput from '../searchv3/user-input'
import {compose, withState, withHandlers, defaultProps} from 'recompose'
import {Box, Icon, Text} from '../common-adapters'
import {connect} from 'react-redux'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {profileSearchResultArray} from '../constants/selectors'

import type {TypedState} from '../constants/reducer'

type OwnProps = {
  navigateUp: () => void,
  onChangeSearchText: (s: string) => void,
  onSelectService: (s: string) => void,
  _search: (term: string, service: SearchConstants.Service) => void,
  searchText: string,
  selectedService: string,
  usernameText: string,
}
const mapStateToProps = (state: TypedState) => ({
  ids: profileSearchResultArray(state),
})
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, onBack, onToggleSidePanel}: OwnProps) => ({
  _clearSearchResults: id => dispatch(Creators.clearSearchResults()),
  _onClick: username => {
    dispatch(navigateUp())
    dispatch(onUserClick(username))
  },
  _search: debounce(
    (term: string, service) => dispatch(SearchCreators.search(term, 'profile:updateSearchResults', service)),
    1e3
  ),
  onClose: () => dispatch(navigateUp()),
})

const Search = props => {
  return (
    <Box style={styleSearchContainer}>
      <Box style={{...styleSearchRow}}>
        <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
          <Box style={{flexGrow: 1}}>
            <UserInput
              userItems={props.userItems}
              showAddButton={props.showAddButton}
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
          <Icon style={{alignSelf: 'center'}} type="iconfont-close" onClick={props.onClose} />
        </Box>
      </Box>
      <Box style={{...styleSearchRow, justifyContent: 'center'}}>
        <Text style={{marginRight: globalMargins.tiny}} type="BodySmall">Filter:</Text>
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
      </Box>
      <Box style={{...styleSearchRow, ...globalStyles.scrollable}}>
        <ResultsList items={props.ids} onClick={props.onClick} selectedId={null} />
      </Box>
    </Box>
  )
}

const styleSearchContainer = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  borderRadius: 5,
  boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
  flex: 1,
  left: 300,
  minHeight: 400,
  minWidth: 500,
  padding: globalMargins.small,
  position: 'absolute',
  top: 10,
  width: 500,
  zIndex: 20,
}

const styleSearchRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  padding: globalMargins.tiny,
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('usernameText', '_onChangeText', ''),
  withState('selectedService', '_onSelectService', 'Keybase'),
  withState('searchText', 'onChangeSearchText', ''),
  withHandlers({
    onChangeText: (props: OwnProps & {_onSelectService: Function}) => nextText => {
      props.onChangeSearchText(nextText)
      props._search(nextText, props.selectedService)
    },
    onClick: props => id => {
      props._onClick(id)
      props._onChangeText('')
      props._clearSearchResults()
    },
    onSelectService: (props: OwnProps & {_onSelectService: Function}) => nextService => {
      props._onSelectService(nextService)
      props._search(props.searchText, nextService)
    },
  }),
  defaultProps({
    placeholder: 'Type someone',
    showAddButton: false,
    userItems: [],
  })
)(Search)
