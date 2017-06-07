// @flow
import React from 'react'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/searchv3/creators'
import {List} from 'immutable'
import {debounce} from 'lodash'
import SearchHeader from './search-header'
import ServiceFilter from '../searchv3/services-filter'
import ResultsList from '../searchv3/results-list'
import {compose, renderComponent, branch, withState, withHandlers, defaultProps} from 'recompose'
import {Box} from '../common-adapters'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {TypedState} from '../constants/reducer'

type OwnProps = {}

const mapStateToProps = ({chat: {searchResults}}: TypedState, {sidePanelOpen}: OwnProps) => ({
  ids: searchResults.toArray(),
})

const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleSidePanel}: OwnProps) => ({
  _search: debounce(
    (term: string, service) => dispatch(SearchCreators.search(term, 'chat:updateSearchResults', service)),
    1e3
  ),
  _onClick: id => {
    dispatch(Creators.stageUserForSearch(id))
    dispatch(Creators.clearSearchResults())
  },
  _clearSearchResults: id => dispatch(Creators.clearSearchResults()),
  onShowTracker: id => console.log('show tracker of', id),
})

const Search = props => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <SearchHeader usernameText={props.usernameText} onChangeText={props.onChangeText} />
      <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
      <ResultsList items={props.ids} onClick={props.onClick} onShowTracker={props.onShowTracker} />
    </Box>
  )
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
    placeholder: 'Search for someone',
    userItems: [],
    showAddButton: true,
    onRemoveUser: () => console.log('todo'),
    onClickAddButton: () => console.log('todo'),
  })
)(Search)
