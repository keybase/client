// @flow
import React from 'react'
import * as Creators from '../actions/chat/creators'
import * as SearchCreators from '../actions/searchv3/creators'
import * as SearchConstants from '../constants/searchv3'
import * as Constants from '../constants/chat'
import UserInput from '../searchv3/user-input'
import ServiceFilter from '../searchv3/services-filter'
import {Box, Icon} from '../common-adapters'
import {compose, withState, defaultProps, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {globalStyles, globalMargins} from '../styles'
import {chatSearchResultArray} from '../constants/selectors'
import {onChangeSelectedSearchResultHoc, showServiceLogicHoc} from '../searchv3/helpers'
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
  exitSearch: () => dispatch(Creators.exitSearch()),
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
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48}}>
        <Box style={{flex: 1, marginLeft: globalMargins.medium}}>
          <UserInput
            ref={props.setInputRef}
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
        {props.showServiceFilter &&
          <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
      </Box>
    </Box>
  )
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedService', '_onSelectService', 'Keybase'),
  showServiceLogicHoc,
  onChangeSelectedSearchResultHoc,
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
        props.search(props.usernameText, nextService)
      },
    }
  }),
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
