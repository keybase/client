// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import {List} from 'immutable'
import {ChannelHeader, UsernameHeader} from '.'
import {branch, compose, renderComponent} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {showUserProfile} from '../../../actions/profile'
import {chatTab} from '../../../constants/tabs'

import type {TypedState} from '../../../constants/reducer'
import type {OwnProps} from './container'

const getUsers = createSelector(
  [Constants.getYou, Constants.getTLF, Constants.getFollowingMap, Constants.getMetaDataMap],
  (you, tlf, followingMap, metaDataMap) =>
    Constants.usernamesToUserListItem(
      Constants.participantFilter(List(tlf.split(',')), you).toArray(),
      you,
      metaDataMap,
      followingMap
    )
)

const mapStateToProps = (state: TypedState, {infoPanelOpen}: OwnProps) => ({
  badgeNumber: state.notifications.get('navBadges').get(chatTab),
  channelName: Constants.getChannelName(state),
  muted: Constants.getMuted(state),
  infoPanelOpen,
  teamName: Constants.getTeamName(state),
  users: getUsers(state),
})

const mapDispatchToProps = (
  dispatch: Dispatch,
  {onBack, onToggleInfoPanel, isPendingConversation}: OwnProps
) => ({
  onBack,
  onOpenFolder: () => dispatch(Creators.openFolder()),
  onShowProfile: (username: string) => dispatch(showUserProfile(username)),
  onToggleInfoPanel,
  isPendingConversation,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props.channelName && props.teamName, renderComponent(ChannelHeader))
)(UsernameHeader)
