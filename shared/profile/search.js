// @flow
import React from 'react'
import {onUserClick} from '../actions/profile'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/searchv3/creators'
import {debounce} from 'lodash'
import {navigateUp} from '../actions/route-tree'
import SearchHeader from '../chat/search-header'
import ServiceFilter from '../searchv3/services-filter'
import ResultsList from '../searchv3/results-list'
import {compose, withState, withHandlers, defaultProps} from 'recompose'
import {Box, Icon, Text} from '../common-adapters'
import {connect} from 'react-redux'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {TypedState} from '../constants/reducer'

type OwnProps = {navigateUp: () => void}
const mapStateToProps = ({chat: {searchResults}}: TypedState) => ({
  ids: searchResults.toArray(),
})
const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleSidePanel}: OwnProps) => ({
  _search: debounce(
    (term: string, service) => dispatch(SearchCreators.search(term, 'chat:updateSearchResults', service)),
    1e3
  ),
  _onClick: username => {
    dispatch(navigateUp())
    dispatch(onUserClick(username))
  },
  _clearSearchResults: id => dispatch(Creators.clearSearchResults()),
  onShowTracker: id => console.log('show tracker of', id),
  onClose: () => dispatch(navigateUp()),
})

const Search = props => {
  return (
    <Box style={styleSearchContainer}>
      <Box style={{...styleSearchRow}}>
        <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
          <Box style={{flexGrow: 1}}>
            <SearchHeader
              showAddButton={false}
              placeholder={props.placeholder}
              usernameText={props.usernameText}
              onChangeText={props.onChangeText}
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
        <ResultsList items={props.ids} onClick={props.onClick} onShowTracker={props.onShowTracker} />
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
  padding: globalMargins.tiny,
  alignItems: 'center',
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('usernameText', '_onChangeText', ''),
  withState('selectedService', '_onSelectService', 'Keybase'),
  withHandlers({
    onChangeText: props => nextText => {
      props._onChangeText(nextText)
      if (nextText) {
        props._search(nextText, props.selectedService)
      } else {
        props._clearSearchResults()
      }
    },
    onSelectService: props => nextService => {
      props._onSelectService(nextService)
      if (props.usernameText) {
        props._search(props.usernameText, nextService)
      } else {
        props._clearSearchResults()
      }
    },
    onClick: props => id => {
      props._onClick(id)
      props._onChangeText('')
      props._clearSearchResults()
    },
  }),
  defaultProps({
    placeholder: 'Type someone',
    userItems: [],
    showAddButton: false,
  })
)(Search)
