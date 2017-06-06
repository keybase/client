// @flow
import * as Creators from '../actions/chat/creators'
import {List} from 'immutable'
import UserInput from '../searchv3/user-input'
import {compose, renderComponent, branch, withState, defaultProps} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'

import type {TypedState} from '../constants/reducer'
import type {UserDetails} from '../searchv3/user-input'

type OwnProps = {}

const mapStateToProps = (
  {chat: {selectedUsersInSearch}, entities: {searchResults}}: TypedState,
  {sidePanelOpen}: OwnProps
) => {
  const selectedUsers = selectedUsersInSearch.map(id => searchResults.get(id).toObject())

  // TODO upgrade results that have keybase user (? do we want this ?)
  const userItems: Array<UserDetails> = selectedUsers.map(u => ({
    id: u.id,
    followState: 'NoState', // TODO get from elsewhere in the store
    icon: u.leftIcon,
    service: u.leftService,
    username: u.leftUsername,
  }))

  return {userItems}
}
const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleSidePanel}: OwnProps) => ({
  onRemoveUser: id => dispatch(Creators.unstageUserForSearch(id)),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  defaultProps({
    placeholder: 'Search for someone',
    showAddButton: true,
    onClickAddButton: () => console.log('todo'),
  })
)(UserInput)
