// @flow
import * as React from 'react'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/search/creators'
import {getProfile} from '../actions/tracker'
import * as Constants from '../constants/chat'
import UserInput from '../search/user-input'
import SearchResultsList from '../search/results-list'
import ServiceFilter from '../search/services-filter'
import {Box, Icon, ProgressIndicator, HeaderHoc} from '../common-adapters'
import {branch, compose, withState, defaultProps, withHandlers, withPropsOnChange} from 'recompose'
import {connect} from 'react-redux'
import {globalMargins, globalStyles} from '../styles'
import {chatSearchPending, chatSearchResultArray, chatSearchShowingSuggestions} from '../constants/selectors'
import {isMobile} from '../constants/platform'
import {onChangeSelectedSearchResultHoc, showServiceLogicHoc, selectedSearchIdHoc} from '../search/helpers'
import {createSelector} from 'reselect'

const mapStateToProps = createSelector(
  [Constants.getUserItems, chatSearchResultArray, chatSearchPending, chatSearchShowingSuggestions],
  (userItems, searchResultIds, searchPending, searchShowingSuggestions) => ({
    searchResultIds,
    showSearchPending: searchPending,
    showSearchSuggestions: searchShowingSuggestions,
    userItems,
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
  onStageUserForSearch: id => dispatch(Creators.stageUserForSearch(id)),
  _onClickSearchResult: id => {
    dispatch(Creators.stageUserForSearch(id))
  },
  onShowTrackerInSearch: id => dispatch(getProfile(id, false, true)),
  onAddSelectedUser: id => dispatch(Creators.stageUserForSearch(id)),
})

const SearchHeader = props => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48}}>
      <Box style={{flex: 1, marginLeft: globalMargins.medium}}>
        <UserInput
          autoFocus={true}
          userItems={props.userItems}
          onRemoveUser={props.onRemoveUser}
          onClickAddButton={props.onClickAddButton}
          placeholder={props.placeholder}
          usernameText={props.searchText}
          onChangeText={props.onChangeText}
          onMoveSelectUp={props.onMoveSelectUp}
          onMoveSelectDown={props.onMoveSelectDown}
          onCancel={props.onExitSearch}
          onAddSelectedUser={props.onAddSelectedUser}
        />
      </Box>
      <Icon
        type="iconfont-close"
        style={{height: 16, width: 16, marginRight: 10}}
        onClick={props.onExitSearch}
      />
    </Box>
    <Box style={{alignSelf: 'center'}}>
      {props.showServiceFilter &&
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
    </Box>
    {props.showSearchPending
      ? <ProgressIndicator style={{width: globalMargins.large}} />
      : <SearchResultsList
          style={{flex: 1}}
          items={props.searchResultIds}
          onClick={props.onClickSearchResult}
          onShowTracker={props.onShowTrackerInSearch}
          selectedId={props.selectedSearchId}
          showSearchSuggestions={props.showSearchSuggestions}
        />}
  </Box>
)

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedService', '_onSelectService', 'Keybase'),
  withState('searchText', 'onChangeSearchText', ''),
  selectedSearchIdHoc,
  onChangeSelectedSearchResultHoc,
  showServiceLogicHoc,
  withHandlers({
    onSelectService: props => nextService => {
      props._onSelectService(nextService)
      props.search(props.searchText, nextService)
    },
    onClickSearchResult: props => id => {
      props.onChangeSearchText('')
      props._onClickSearchResult(id)
      props.clearSearchResults()
    },
  }),
  branch(
    () => isMobile,
    compose(
      withPropsOnChange(['onExitSearch'], props => ({
        onCancel: () => props.onExitSearch(),
        title: 'New Chat',
      })),
      HeaderHoc
    )
  ),
  defaultProps({
    placeholder: 'Search for someone',
  })
)(SearchHeader)
