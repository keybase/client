// @flow
import React from 'react'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/searchv3/creators'
import * as SearchConstants from '../constants/searchv3'
import UserInput from '../searchv3/user-input'
import ServiceFilter from '../searchv3/services-filter'
import {Box, Icon} from '../common-adapters'
import {compose, withState, defaultProps, withHandlers} from 'recompose'
import {connect} from 'react-redux'
import {globalStyles, globalMargins} from '../styles'
import {parseUserId, serviceIdToIcon} from '../util/platforms'
import {chatSearchResultArray} from '../constants/selectors'
import {onChangeSelectedSearchResultHoc} from '../searchv3/helpers'

import type {TypedState} from '../constants/reducer'

type OwnProps = {
  searchText: string,
  onChangeSearchText: (s: string) => void,
  usernameText: string,
  selectedService: string,
  onSelectService: (s: string) => void,
  search: (term: string, service: SearchConstants.Service) => void,
  selectedSearchId: ?SearchConstants.SearchResultId,
  onUpdateSelectedSearchResult: (id: SearchConstants.SearchResultId) => void,
}

const mapStateToProps = (state: TypedState) => {
  const {chat: {inboxSearch}} = state

  const userItems = inboxSearch.map(id => {
    const {username, serviceId} = parseUserId(id)
    const service = SearchConstants.serviceIdToService(serviceId)
    return {
      id: id,
      followState: SearchConstants.followStateHelper(state, username, service),
      // $FlowIssue ??
      icon: serviceIdToIcon(serviceId),
      username,
      service,
    }
  })

  return {
    userItems,
    searchResultIds: chatSearchResultArray(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onRemoveUser: id => dispatch(Creators.unstageUserForSearch(id)),
  exitSearch: () => dispatch(Creators.exitSearch()),
  clearSearchResults: () => dispatch(Creators.clearSearchResults()),
  search: (term: string, service) => {
    if (term) {
      dispatch(SearchCreators.search(term, 'chat:updateSearchResults', service))
    } else {
      dispatch(Creators.clearSearchResults())
    }
  },
  onStageUserForSearch: id => dispatch(Creators.stageUserForSearch(id)),
})

const SearchHeader = props => {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48}}>
        <Box style={{flex: 1, marginLeft: globalMargins.medium}}>
          <UserInput
            autoFocus={true}
            userItems={props.userItems}
            showAddButton={props.showAddButton}
            onRemoveUser={props.onRemoveUser}
            onClickAddButton={props.onClickAddButton}
            placeholder={props.placeholder}
            usernameText={props.usernameText}
            onChangeText={props.onChangeText}
            onMoveSelectUp={props.onMoveSelectUp}
            onMoveSelectDown={props.onMoveSelectDown}
            onEnter={props.onEnter}
          />
        </Box>
        <Icon
          type="iconfont-close"
          style={{height: 16, width: 16, marginRight: 10}}
          onClick={props.exitSearch}
        />
      </Box>
      <Box style={{alignSelf: 'center'}}>
        <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />
      </Box>
    </Box>
  )
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedService', '_onSelectService', 'Keybase'),
  onChangeSelectedSearchResultHoc,
  withHandlers({
    onSelectService: (props: OwnProps & {_onSelectService: Function}) => nextService => {
      props._onSelectService(nextService)
      props.search(props.usernameText, nextService)
    },
  }),
  defaultProps({
    placeholder: 'Search for someone',
    showAddButton: false,
    onClickAddButton: () => console.log('todo'),
    userItems: [],
  })
)(SearchHeader)
