// @flow
import * as Constants from '../../constants/search'
import * as HocHelpers from '../helpers'
import * as SearchGen from '../../actions/search-gen'
import React from 'react'
import ServiceFilter from '../services-filter'
import UserInput, {type Props as _Props} from '.'
import {Box, Text} from '../../common-adapters'
import {namedConnect} from '../../util/container'
import {
  globalStyles,
  globalMargins,
  globalColors,
  collapseStyles,
  type StylesCrossPlatform,
} from '../../styles'
import {parseUserId, serviceIdToIcon} from '../../util/platforms'
import {withStateHandlers, withHandlers, withProps, compose, lifecycle} from 'recompose'

import type {TypedState} from '../../constants/reducer'

export type OwnProps = {|
  searchKey: string,
  autoFocus?: boolean,
  focusInputCounter?: number,
  placeholder?: string,
  onFocus?: () => void,
  onChangeSearchText?: (searchText: string) => void,
  onExitSearch: ?() => void,
  onSelectUser?: (id: string) => void,
  hideAddButton?: boolean,
  disableListBuilding?: boolean,
  showServiceFilter: boolean,
  style?: StylesCrossPlatform,
  // Defaults to true. Desktop only, as clearSearch isn't used on mobile.
  // Note that the way that user input is super wonky with all these HOCs. If we ever refactor, we probably won't need this prop.
  hideClearSearch?: boolean,
|}

const UserInputWithServiceFilter = props => (
  <Box
    style={collapseStyles([
      {
        ...globalStyles.flexBoxColumn,
        borderBottomColor: globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        paddingLeft: globalMargins.tiny,
      },
      props.style,
    ])}
  >
    <UserInput
      ref={props.setInputRef}
      autoFocus={props.autoFocus}
      onFocus={props.onFocus}
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
      selectedSearchId={props.selectedSearchId}
      hideAddButton={props.hideAddButton}
      hideClearSearch={props.hideClearSearch}
    />
    {props.showServiceFilter && (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          minHeight: 48,
        }}
      >
        <Text type="BodySmallSemibold" style={{marginRight: globalMargins.tiny}}>
          Filter:
        </Text>
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
      </Box>
    )}
  </Box>
)

const getSearchResultTerm = ({entities}: TypedState, {searchKey}: {searchKey: string}) => {
  const searchResultQuery = entities.getIn(['search', 'searchKeyToSearchResultQuery', searchKey], null)
  return searchResultQuery && searchResultQuery.text
}

const getFollowingStates = (state, searchKey) => {
  const itemIds = Constants.getUserInputItemIds(state, searchKey)
  const followingStateMap = {}
  itemIds.forEach(id => {
    const {username, serviceId} = parseUserId(id)
    const service = Constants.serviceIdToService(serviceId)
    followingStateMap[id] = Constants.followStateHelper(state, username, service)
  })
  return followingStateMap
}

const getUserItems = (state, searchKey) => {
  const ids = Constants.getUserInputItemIds(state, searchKey)
  const followingStates = getFollowingStates(state, searchKey)
  return ids.map(id => {
    const {username, serviceId} = parseUserId(id)
    const service = Constants.serviceIdToService(serviceId)
    return {
      id: id,
      followingState: followingStates[id],
      icon: serviceIdToIcon(serviceId),
      username,
      service,
    }
  })
}

const mapStateToProps = (state, {searchKey, showServiceFilter}: OwnProps) => {
  const {entities} = state
  const searchResultTerm = getSearchResultTerm(state, {searchKey})
  const _searchResultIds = Constants.getSearchResultIds(state, searchKey)
  const selectedSearchId = entities.getIn(['search', 'searchKeyToSelectedId', searchKey])
  const showingSearchSuggestions = entities.getIn(
    ['search', 'searchKeyToShowSearchSuggestion', searchKey],
    false
  )
  const userItems = getUserItems(state, searchKey)
  const clearSearchTextInput = Constants.getClearSearchTextInput(state, searchKey)
  const showServiceFilterIfInputEmpty =
    state.chat2.get('pendingMode') !== 'searchingForUsers' && showServiceFilter

  return {
    clearSearchTextInput,
    _searchResultIds,
    selectedSearchId,
    userItems,
    searchResultTerm,
    showServiceFilterIfInputEmpty,
    showingSearchSuggestions,
  }
}

const mapDispatchToProps = (dispatch, {searchKey}) => ({
  onRemoveUser: id => dispatch(SearchGen.createRemoveResultsToUserInput({searchKey, searchResults: [id]})),
  search: (term: string, service) => {
    if (term) {
      dispatch(SearchGen.createSearch({term, searchKey, service}))
    } else {
      dispatch(SearchGen.createSearchSuggestions({searchKey}))
    }
  },
  onAddUser: id => id && dispatch(SearchGen.createAddResultsToUserInput({searchKey, searchResults: [id]})),
  clearSearchResults: () => dispatch(SearchGen.createClearSearchResults({searchKey})),
  onUpdateSelectedSearchResult: id => {
    dispatch(SearchGen.createUpdateSelectedSearchResult({searchKey, id}))
  },
})

export type Props = _Props & {
  // From onChangeSelectedSearchResultHoc.
  search: Function,
}

const noResults = []
const ConnectedUserInput = compose(
namedConnect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o: OwnProps) => ({
      ...o,
      ...s,
      ...d,
      searchResultIds: s._searchResultIds ? s._searchResultIds.toArray() : noResults,
    }),
    'UserInput'
  ),
  withStateHandlers(
    {searchText: '', selectedService: 'Keybase'},
    {
      _onSelectService: () => selectedService => ({selectedService}),
      onChangeSearchText: (_, props) => searchText => {
        if (props.onChangeSearchText) {
          props.onChangeSearchText(searchText)
        }
        return {searchText}
      },
    }
  ),
  HocHelpers.onChangeSelectedSearchResultHoc,
  HocHelpers.clearSearchHoc,
  HocHelpers.placeholderServiceHoc,
  withProps(props => ({
    showServiceFilter: (props.showServiceFilterIfInputEmpty || !!props.searchText) && props.showServiceFilter,
  })),
  withHandlers(() => {
    let input
    return {
      setInputRef: () => el => {
        input = el
      },
      onFocusInput: () => () => {
        input && input.focus()
      },
      onSelectService: props => nextService => {
        props._onSelectService(nextService)
        props.clearSearchResults()
        props.search(props.searchText, nextService)
        input && input.focus()
      },
      onClickAddButton: props => () => {
        props.search('', props.selectedService)
      },
    }
  }),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
        this.props.onFocusInput()
      }

      if (this.props.searchResultIds !== prevProps.searchResultIds && !this.props.showingSearchSuggestions) {
        this.props.onUpdateSelectedSearchResult(
          (this.props.searchResultIds && this.props.searchResultIds[0]) || null
        )
        this.props.onFocusInput()
      }

      if (this.props.clearSearchTextInput !== prevProps.clearSearchTextInput) {
        this.props.onChangeSearchText('')
      }
    },
  })
)(UserInputWithServiceFilter)

export default ConnectedUserInput
