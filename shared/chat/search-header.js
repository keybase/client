// @flow
import React from 'react'
import * as Immutable from 'immutable'
import * as Creators from '../actions/chat/creators'
import * as SearchConstants from '../constants/searchv3'
import UserInput from '../searchv3/user-input'
import ServiceFilter from '../searchv3/services-filter'
import {List} from 'immutable'
import {Box, Icon} from '../common-adapters'
import {compose, renderComponent, branch, withState, defaultProps, withHandlers} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {parseUserId, serviceIdToIcon} from '../util/platforms'

import type {TypedState} from '../constants/reducer'
import type {UserDetails} from '../searchv3/user-input'

type OwnProps = {}

const mapStateToProps = (
  {chat: {inboxSearch}, entities: {searchResults}}: TypedState,
  {sidePanelOpen}: OwnProps
) => {
  // TODO upgrade results that have keybase user (? do we want this ?)
  const userItems = inboxSearch.map(id => {
    const {username, serviceId} = parseUserId(id)
    return {
      id: id,
      followState: 'NoState', // TODO get from elsewhere in the store
      icon: serviceIdToIcon(serviceId),
      username,
      service: SearchConstants.serviceIdToService(serviceId),
    }
  })

  return {userItems}
}
const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleSidePanel}: OwnProps) => ({
  onRemoveUser: id => dispatch(Creators.unstageUserForSearch(id)),
  exitSearch: () => dispatch(Creators.exitSearch()),
})

type InProps = {
  search: (term: string, service: ConstantsService) => void,
  searchText: string,
  onChangeSearchText: string,
}

const SearchHeader = props => {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', minHeight: 48}}>
        <Box style={{flex: 1, marginLeft: globalMargins.medium}}>
          <UserInput
            userItems={props.userItems}
            showAddButton={props.showAddButton}
            onRemoveUser={props.onRemoveUser}
            onClickAddButton={props.onClickAddButton}
            placeholder={props.placeholder}
            usernameText={props.usernameText}
            onChangeText={props.onChangeText}
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

// TODO clear results when you search an empty string

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('selectedService', '_onSelectService', 'Keybase'),
  withHandlers({
    onChangeText: props => nextText => {
      props.onChangeSearchText(nextText)
      props.search(nextText, props.selectedService)
    },
    onSelectService: props => nextService => {
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
