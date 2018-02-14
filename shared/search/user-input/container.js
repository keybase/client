// @flow
import * as Constants from '../../constants/search'
import * as HocHelpers from '../helpers'
import * as SearchGen from '../../actions/search-gen'
import React from 'react'
import ServiceFilter from '../services-filter'
import UserInput from '.'
import {Box, Text} from '../../common-adapters'
import {connect} from 'react-redux'
import {createShallowEqualSelector} from '../../util/container'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {parseUserId, serviceIdToIcon} from '../../util/platforms'
import {withState, withHandlers, compose, lifecycle} from 'recompose'

import type {TypedState} from '../../constants/reducer'

type OwnProps = {|
  searchKey: string,
  autoFocus?: boolean,
  focusInputCounter?: number,
  placeholder: ?string,
  onExitSearch: ?() => void,
  onSelectUser?: (id: string) => void,
  disableListBuilding?: boolean,
|}

const UserInputWithServiceFilter = props => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      borderBottomColor: globalColors.black_05,
      borderBottomWidth: 1,
      borderStyle: 'solid',
      paddingLeft: globalMargins.tiny,
    }}
  >
    <UserInput
      ref={props.setInputRef}
      autoFocus={props.autoFocus}
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
    />
    {props.showServiceFilter && (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
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

const getFollowingStates = (state, ownProps) => {
  const itemIds = Constants.getUserInputItemIds(state, ownProps)
  const followingStateMap = {}
  itemIds.forEach(id => {
    const {username, serviceId} = parseUserId(id)
    const service = Constants.serviceIdToService(serviceId)
    followingStateMap[id] = Constants.followStateHelper(state, username, service)
  })
  return followingStateMap
}

const getUserItems = createShallowEqualSelector(
  [Constants.getUserInputItemIds, getFollowingStates],
  (ids, followingStates) =>
    ids.map(id => {
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
)

const mapStateToProps = (state: TypedState, {searchKey}: OwnProps) => {
  const {entities} = state
  const searchResultTerm = getSearchResultTerm(state, {searchKey})
  const searchResultIds = Constants.getSearchResultIdsArray(state, {searchKey})
  const selectedSearchId = entities.getIn(['search', 'searchKeyToSelectedId', searchKey])
  const showingSearchSuggestions = entities.getIn(
    ['search', 'searchKeyToShowSearchSuggestion', searchKey],
    false
  )
  const userItems = getUserItems(state, {searchKey})
  const clearSearchTextInput = Constants.getClearSearchTextInput(state, {searchKey})
  return {
    clearSearchTextInput,
    searchResultIds,
    selectedSearchId,
    userItems,
    searchResultTerm,
    showingSearchSuggestions,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {searchKey}) => ({
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

const ConnectedUserInput: Class<React.Component<OwnProps, void>> = compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('searchText', 'onChangeSearchText', ''),
  withState('selectedService', '_onSelectService', 'Keybase'),
  HocHelpers.onChangeSelectedSearchResultHoc,
  HocHelpers.clearSearchHoc,
  HocHelpers.showServiceLogicHoc,
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
    componentWillReceiveProps(nextProps) {
      if (this.props.focusInputCounter !== nextProps.focusInputCounter) {
        this.props.onFocusInput()
      }

      if (this.props.searchResultIds !== nextProps.searchResultIds) {
        nextProps.onUpdateSelectedSearchResult(
          (nextProps.searchResultIds && nextProps.searchResultIds[0]) || null
        )
      }

      if (this.props.clearSearchTextInput !== nextProps.clearSearchTextInput) {
        nextProps.onChangeSearchText('')
      }
    },
  })
)(UserInputWithServiceFilter)

export default ConnectedUserInput
