// @flow
import React from 'react'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/searchv3/creators'
import * as SearchConstants from '../constants/searchv3'
import * as Constants from '../constants/chat'
import UserInput from '../searchv3/user-input'
import ServiceFilter from '../searchv3/services-filter'
import {Box} from '../common-adapters'
import {compose, withState, defaultProps, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {globalStyles} from '../styles'
import {chatSearchResultArray} from '../constants/selectors'
import * as HocHelpers from '../searchv3/helpers'
import {createSelector} from 'reselect'

type OwnProps = {
  selectedConversationIDKey: Constants.ConversationIDKey,
  searchText: string,
  onChangeSearchText: (s: string) => void,
  selectedService: string,
  onSelectService: (s: string) => void,
  search: (term: string, service: SearchConstants.Service) => void,
  selectedSearchId: ?SearchConstants.SearchResultId,
  onUpdateSelectedSearchResult: (id: SearchConstants.SearchResultId) => void,
  showServiceFilter: boolean,
}

const mapStateToProps = createSelector(
  [Constants.getUserItems, chatSearchResultArray],
  (userItems, searchResultIds) => ({
    userItems,
    searchResultIds,
  })
)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onRemoveUser: id => dispatch(Creators.unstageUserForSearch(id)),
  onExitSearch: () => dispatch(Creators.exitSearch()),
  clearSearchResults: () => dispatch(Creators.clearSearchResults()),
  search: (term: string, service) => {
    if (term) {
      dispatch(SearchCreators.search(term, 'chat:updateSearchResults', service))
    } else {
      dispatch(SearchCreators.searchSuggestions('chat:updateSearchResults'))
    }
  },
  onEnter: id => dispatch(Creators.stageUserForSearch(id)),
})

const SearchHeader = props => {
  return (
    <Box style={globalStyles.flexBoxColumn}>
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
        onEnter={props.onEnter}
        onClearSearch={props.onClearSearch}
      />
      <Box style={{alignSelf: 'center'}}>
        {props.showServiceFilter &&
          <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
      </Box>
    </Box>
  )
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedService', '_onSelectService', 'Keybase'),
  HocHelpers.showServiceLogicHoc,
  HocHelpers.onChangeSelectedSearchResultHoc,
  withHandlers(() => {
    let input
    return {
      setInputRef: () => el => {
        input = el
      },
      onFocusInput: () => () => {
        input.focus()
      },
      onSelectService: (props: OwnProps & {_onSelectService: Function}) => nextService => {
        props._onSelectService(nextService)
        props.search(props.searchText, nextService)
      },
    }
  }),
  HocHelpers.clearSearchHoc,
  defaultProps({
    placeholder: 'Search for someone',
    showAddButton: false,
    onClickAddButton: () => console.log('todo'),
  }),
  lifecycle({
    componentWillReceiveProps(nextProps: OwnProps) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        this.props.onFocusInput()
      }
    },
  })
)(SearchHeader)
