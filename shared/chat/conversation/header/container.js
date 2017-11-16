// @flow
import * as Constants from '../../../constants/chat'
import * as ChatGen from '../../../actions/chat-gen'
import {List} from 'immutable'
import {ChannelHeader, UsernameHeader} from '.'
import {branch, compose, renderComponent, connect, type TypedState} from '../../../util/container'
import {createSelector} from 'reselect'
import {showUserProfile} from '../../../actions/profile'
import {chatTab} from '../../../constants/tabs'
import {type OwnProps} from './container'

const getUsers = createSelector(
  [Constants.getYou, Constants.getParticipants, Constants.getFollowingMap, Constants.getMetaDataMap],
  (you, participants, followingMap, metaDataMap) =>
    Constants.usernamesToUserListItem(
      Constants.participantFilter(List(participants), you).toArray(),
      you,
      metaDataMap,
      followingMap
    )
)

const mapStateToProps = (state: TypedState, {infoPanelOpen}: OwnProps) => ({
  badgeNumber: state.notifications.get('navBadges').get(chatTab),
  canOpenInfoPanel: !Constants.isPendingConversationIDKey(Constants.getSelectedConversation(state) || ''),
  channelName: Constants.getChannelName(state),
  muted: Constants.getMuted(state),
  infoPanelOpen,
  teamName: Constants.getTeamName(state),
  users: getUsers(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleInfoPanel}: OwnProps) => ({
  onBack,
  onOpenFolder: () => dispatch(ChatGen.createOpenFolder()),
  onShowProfile: (username: string) => dispatch(showUserProfile(username)),
  onToggleInfoPanel,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props.channelName && props.teamName, renderComponent(ChannelHeader))
)(UsernameHeader)
