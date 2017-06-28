// @flow
import {clearSearchResults, onUserClick} from '../actions/profile'
import * as SearchCreators from '../actions/searchv3/creators'
import * as SearchConstants from '../constants/searchv3'
import {compose, withState, withHandlers, defaultProps} from 'recompose'
import {connect} from 'react-redux'
import {profileSearchResultArray} from '../constants/selectors'
import Search from './search'
import {onChangeSelectedSearchResultHoc, selectedSearchIdHoc, showServiceLogicHoc} from '../searchv3/helpers'

import type {Props} from './search'
import type {TypedState} from '../constants/reducer'

type HocIntermediateProps = {
  _clearSearchResults: () => void,
  _onClick: (id: string) => void,
  _onChangeText: (nextText: string) => void,
  _onSelectService: () => void,
  _onSelectService: (nextService: string) => void,
  search: (term: string, service: SearchConstants.Service) => void,
  selectedSearchId: ?SearchConstants.SearchResultId,
  onUpdateSelectedSearchResult: (id: SearchConstants.SearchResultId) => void,
}

const mapStateToProps = (state: TypedState) => ({
  searchResultIds: profileSearchResultArray(state),
})
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, onBack, onToggleSidePanel}: Props) => ({
  _clearSearchResults: () => dispatch(clearSearchResults()),
  search: (term: string, service) => {
    if (term) {
      dispatch(SearchCreators.search(term, 'profile:updateSearchResults', service))
    } else {
      dispatch(SearchCreators.searchSuggestions('profile:updateSearchResults'))
    }
  },
  onEnter: username => {
    dispatch(navigateUp())
    dispatch(onUserClick(username))
  },
  _onClick: username => {
    dispatch(navigateUp())
    dispatch(onUserClick(username))
  },
  onClose: () => {
    dispatch(clearSearchResults())
    dispatch(navigateUp())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('usernameText', '_onChangeText', ''),
  withState('selectedService', '_onSelectService', 'Keybase'),
  selectedSearchIdHoc,
  onChangeSelectedSearchResultHoc,
  showServiceLogicHoc,
  withHandlers({
    onChangeText: (props: Props & HocIntermediateProps) => nextText => {
      props._onChangeText(nextText)
      props.search(nextText, props.selectedService)
    },
    onClick: (props: Props & HocIntermediateProps) => id => {
      props._onClick(id)
      props._onChangeText('')
      props._clearSearchResults()
    },
    onSelectService: (props: Props & HocIntermediateProps) => nextService => {
      props._onSelectService(nextService)
      props.search(props.usernameText, nextService)
    },
  }),
  defaultProps({
    placeholder: 'Type someone',
    showAddButton: false,
    userItems: [],
  })
)(Search)
