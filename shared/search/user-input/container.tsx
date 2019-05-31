import * as Constants from '../../constants/search'
import * as HocHelpers from '../helpers'
import * as SearchGen from '../../actions/search-gen'
import React from 'react'
import ServiceFilter from '../services-filter'
import UserInput, {Props as _Props} from '.'
import {Box, Text} from '../../common-adapters'
import {namedConnect} from '../../util/container'
import {globalStyles, globalMargins, globalColors, collapseStyles, StylesCrossPlatform} from '../../styles'
import {parseUserId, serviceIdToIcon} from '../../util/platforms'
import {withStateHandlers, withHandlers, withProps, compose, lifecycle} from 'recompose'

import {TypedState} from '../../constants/reducer'

export type OwnProps = {
  searchKey: string
  autoFocus?: boolean
  focusInputCounter?: number
  placeholder?: string
  onFocus?: () => void
  onChangeSearchText?: (searchText: string) => void
  onExitSearch: (() => void) | null
  onSelectUser?: (id: string) => void
  hideAddButton?: boolean
  disableListBuilding?: boolean
  showServiceFilter: boolean
  style?: StylesCrossPlatform
  // Defaults to true. Desktop only, as clearSearch isn't used on mobile.
  // Note that the way that user input is super wonky with all these HOCs. If we ever refactor, we probably won't need this prop.
  hideClearSearch?: boolean
}

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

const getSearchResultTerm = (
  {entities}: TypedState,
  {
    searchKey,
  }: {
    searchKey: string
  }
) => {
  const searchResultQuery = entities.getIn(['search', 'searchKeyToSearchResultQuery', searchKey]) || null
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
      followingState: followingStates[id],
      icon: serviceIdToIcon(serviceId),
      id: id,
      service,
      username,
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
  const showServiceFilterIfInputEmpty = showServiceFilter

  return {
    _searchResultIds,
    clearSearchTextInput,
    searchResultTerm,
    selectedSearchId,
    showServiceFilterIfInputEmpty,
    showingSearchSuggestions,
    userItems,
  }
}

const mapDispatchToProps = (dispatch, {searchKey}) => ({
  clearSearchResults: () => dispatch(SearchGen.createClearSearchResults({searchKey})),
  onAddUser: id => id && dispatch(SearchGen.createAddResultsToUserInput({searchKey, searchResults: [id]})),
  onRemoveUser: id => dispatch(SearchGen.createRemoveResultsToUserInput({searchKey, searchResults: [id]})),
  onUpdateSelectedSearchResult: id => {
    dispatch(SearchGen.createUpdateSelectedSearchResult({id, searchKey}))
  },
  search: (term: string, service) => {
    if (term) {
      dispatch(SearchGen.createSearch({searchKey, service, term}))
    } else {
      dispatch(SearchGen.createSearchSuggestions({searchKey}))
    }
  },
})

export type Props = _Props & {
  // From onChangeSelectedSearchResultHoc.
  search: Function
}

const noResults = []
const ConnectedUserInput: any = compose(
  namedConnect(
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
  withStateHandlers({searchText: '', selectedService: 'Keybase'}, {
    _onSelectService: () => selectedService => ({selectedService}),
    onChangeSearchText: (_, props) => searchText => {
      if (props.onChangeSearchText) {
        props.onChangeSearchText(searchText)
      }
      return {searchText}
    },
  } as any),
  HocHelpers.onChangeSelectedSearchResultHoc,
  HocHelpers.clearSearchHoc,
  HocHelpers.placeholderServiceHoc,
  withProps((props: any) => ({
    showServiceFilter: (props.showServiceFilterIfInputEmpty || !!props.searchText) && props.showServiceFilter,
  })),
  withHandlers(
    (): any => {
      let input
      return {
        onClickAddButton: props => () => {
          props.search('', props.selectedService)
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
        setInputRef: () => el => {
          input = el
        },
      }
    }
  ),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (this.props.focusInputCounter !== prevProps.focusInputCounter) {
        this.props.onFocusInput()
      }

      const prevTopResult = prevProps.searchResultIds && prevProps.searchResultIds[0]
      const topResult = this.props.searchResultIds && this.props.searchResultIds[0]

      if (topResult !== prevTopResult && !this.props.showingSearchSuggestions) {
        this.props.onUpdateSelectedSearchResult(topResult)
        this.props.onFocusInput()
      }

      if (this.props.clearSearchTextInput !== prevProps.clearSearchTextInput) {
        this.props.onChangeSearchText('')
      }
    },
  } as any)
)(UserInputWithServiceFilter)

export default ConnectedUserInput
