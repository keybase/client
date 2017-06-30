// @flow
import React from 'react'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/searchv3/creators'
import {getProfile} from '../actions/tracker'
import * as Constants from '../constants/chat'
import UserInput from '../searchv3/user-input'
import SearchResultsList from '../searchv3/results-list'
import ServiceFilter from '../searchv3/services-filter'
import {Box, Icon} from '../common-adapters'
import {compose, withState, defaultProps, withHandlers} from 'recompose'
import {connect} from 'react-redux'
import {globalStyles, globalMargins} from '../styles'
import {chatSearchResultArray} from '../constants/selectors'
import {onChangeSelectedSearchResultHoc, showServiceLogicHoc} from '../searchv3/helpers'
import {createSelector} from 'reselect'

const mapStateToProps = createSelector(
  [Constants.getUserItems, chatSearchResultArray],
  (userItems, searchResultIds) => ({
    userItems,
    searchResultIds,
  })
)

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onRemoveUser: id => dispatch(Creators.unstageUserForSearch(id)),
  exitSearch: () => dispatch(Creators.exitSearch()),
  clearSearchResults: () => dispatch(Creators.clearSearchResults()),
  search: (term: string, service) => {
    if (term) {
      dispatch(SearchCreators.search(term, 'chat:updateSearchResults', service))
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

const SearchHeader = props => {
  return (
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
            onAddSelectedUser={props.onAddSelectedUser}
          />
        </Box>
        <Icon
          type="iconfont-close"
          style={{height: 16, width: 16, marginRight: 10}}
          onClick={props.exitSearch}
        />
      </Box>
      <Box style={{alignSelf: 'center'}}>
        {props.showServiceFilter &&
          <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
      </Box>
      <SearchResultsList
        style={{flex: 1}}
        items={props.searchResultIds}
        onClick={props.onClickSearchResult}
        onShowTracker={props.onShowTrackerInSearch}
        selectedId={props.selectedSearchId}
      />
    </Box>
  )
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedService', '_onSelectService', 'Keybase'),
  withState('searchText', 'onChangeSearchText', ''),
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
  defaultProps({
    placeholder: 'Search for someone',
    showAddButton: false,
    onClickAddButton: () => console.log('todo'),
  })
)(SearchHeader)
