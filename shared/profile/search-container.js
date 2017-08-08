// @flow
import {clearSearchResults, showUserProfile} from '../actions/profile'
import * as SearchCreators from '../actions/search/creators'
import * as SearchConstants from '../constants/search'
import {compose, withState, withHandlers, defaultProps} from 'recompose'
import {connect} from 'react-redux'
import {profileSearchResultArray} from '../constants/selectors'
import Search from './search'
import * as HocHelpers from '../search/helpers'

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
  showSearchPending: state.profile.searchPending,
  showSearchSuggestions: state.profile.searchShowingSuggestions,
})
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, onBack, onToggleInfoPanel}: Props) => ({
  _clearSearchResults: () => dispatch(clearSearchResults()),
  search: (term: string, service) => {
    if (term) {
      dispatch(
        SearchCreators.search(term, 'profile:pendingSearchResults', 'profile:updateSearchResults', service)
      )
    } else {
      dispatch(SearchCreators.searchSuggestions('profile:updateSearchResults'))
    }
  },
  onAddSelectedUser: username => {
    dispatch(navigateUp())
    dispatch(showUserProfile(username))
  },
  _onClick: username => {
    dispatch(navigateUp())
    dispatch(showUserProfile(username))
  },
  onClose: () => {
    dispatch(clearSearchResults())
    dispatch(navigateUp())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  defaultProps({
    placeholder: 'Type someone',
    showAddButton: false,
    userItems: [],
  }),
  withState('searchText', '_onChangeText', ''),
  withState('selectedService', '_onSelectService', 'Keybase'),
  HocHelpers.selectedSearchIdHoc,
  HocHelpers.onChangeSelectedSearchResultHoc,
  HocHelpers.showServiceLogicHoc,
  HocHelpers.placeholderServiceHoc,
  withHandlers(() => {
    let input
    return {
      setInputRef: () => el => {
        input = el
      },
      onChangeText: (props: Props & HocIntermediateProps) => nextText => {
        props._onChangeText(nextText)
        props.search(nextText, props.selectedService)
      },
      onClick: (props: Props & HocIntermediateProps) => id => {
        props._onClick(id)
        props._onChangeText('')
        props._clearSearchResults()
      },
      onMouseOverSearchResult: (props: Props) => id => {
        props.onUpdateSelectedSearchResult(id)
      },
      onSelectService: (props: Props & HocIntermediateProps) => nextService => {
        props._onSelectService(nextService)
        props.search(props.searchText, nextService)
        input && input.focus()
      },
    }
  })
)(Search)
