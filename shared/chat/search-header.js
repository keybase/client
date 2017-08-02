// @flow
import React from 'react'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/search/creators'
import * as SearchConstants from '../constants/search'
import * as Constants from '../constants/chat'
import UserInput from '../search/user-input'
import ServiceFilter from '../search/services-filter'
import {Box} from '../common-adapters'
import {compose, withState, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {globalStyles, globalMargins} from '../styles'
import {chatSearchResultArray, chatSearchResultTerm} from '../constants/selectors'
import * as HocHelpers from '../search/helpers'
import {createSelector} from 'reselect'

type OwnProps = {
  clearSearchResults: () => void,
  selectedConversationIDKey: Constants.ConversationIDKey,
  searchText: string,
  onChangeSearchText: (s: string) => void,
  selectedService: string,
  onSelectService: (s: string) => void,
  search: (term: string, service: SearchConstants.Service) => void,
  selectedSearchId: ?SearchConstants.SearchResultId,
  onUpdateSelectedSearchResult: (id: SearchConstants.SearchResultId) => void,
  showServiceFilter: boolean,
  onAddNewParticipant: (clicked: boolean) => void,
  addNewParticipant: boolean,
}

const mapStateToProps = createSelector(
  [Constants.getUserItems, chatSearchResultArray, chatSearchResultTerm],
  (userItems, searchResultIds, searchResultTerm) => ({
    userItems,
    searchResultIds,
    searchResultTerm,
  })
)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onRemoveUser: id => dispatch(Creators.unstageUserForSearch(id)),
  onExitSearch: () => dispatch(Creators.exitSearch()),
  clearSearchResults: () => dispatch(Creators.clearSearchResults()),
  search: (term: string, service) => {
    if (term) {
      dispatch(SearchCreators.search(term, 'chat:pendingSearchResults', 'chat:updateSearchResults', service))
    } else {
      dispatch(SearchCreators.searchSuggestions('chat:updateSearchResults'))
    }
  },
  onAddSelectedUser: id => dispatch(Creators.stageUserForSearch(id)),
})

const SearchHeader = props => (
  <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.medium}}>
    <UserInput
      ref={props.setInputRef}
      autoFocus={true}
      userItems={props.userItems}
      onRemoveUser={props.onRemoveUser}
      onClickAddButton={props.onClickAddButton}
      placeholder={props.placeholder}
      usernameText={props.searchText}
      onChangeText={props.onChangeText}
      onMoveSelectUp={props.onMoveSelectUp}
      onMoveSelectDown={props.onMoveSelectDown}
      onClearSearch={props.onClearSearch}
      onAddSelectedUser={props.onAddSelectedUser}
      onEnterEmptyText={props.onExitSearch}
      onCancel={props.onExitSearch}
    />
    <Box style={{alignSelf: 'center'}}>
      {props.showServiceFilter &&
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
    </Box>
  </Box>
)

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedService', '_onSelectService', 'Keybase'),
  HocHelpers.showServiceLogicHoc,
  HocHelpers.onChangeSelectedSearchResultHoc,
  HocHelpers.placeholderServiceHoc,
  withHandlers(() => {
    let input
    return {
      setInputRef: () => el => {
        input = el
      },
      onFocusInput: () => () => {
        input && input.focus()
      },
      onSelectService: (props: OwnProps & {_onSelectService: Function}) => nextService => {
        props._onSelectService(nextService)
        props.clearSearchResults()
        props.search(props.searchText, nextService)
        input && input.focus()
      },
      onClickAddButton: (props: OwnProps) => () => {
        props.onAddNewParticipant(true)
        props.search('', props.selectedService)
      },
    }
  }),
  HocHelpers.clearSearchHoc,
  lifecycle({
    componentWillReceiveProps(nextProps: OwnProps) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        this.props.onFocusInput()
      }
    },
  })
)(SearchHeader)
