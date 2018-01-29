// @noflow
import * as I from 'immutable'
import * as Constants2 from '../../../../constants/chat2'
import * as RouteTree from '../../../../actions/route-tree'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {ChannelHeader, UsernameHeader} from '.'
import {
  branch,
  compose,
  renderComponent,
  connect,
  type TypedState,
  type Dispatch,
} from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {chatTab} from '../../../../constants/tabs'

const mapStateToProps = (state: TypedState, {infoPanelOpen, conversationIDKey}) => {
  const meta = Constants2.getMeta(state, conversationIDKey)
  let _participants
  if (state.chat2.pendingSelected) {
    _participants = state.chat2.pendingConversationUsers.toSet()
  } else {
    _participants = meta.teamname ? I.Set() : meta.participants
  }
  return {
    _participants,
    badgeNumber: state.notifications.getIn(['navBadges', chatTab]),
    canOpenInfoPanel: true, //! Constants.isPendingConversationIDKey(Constants.getSelectedConversation(state) || ''),
    channelName: meta.channelname,
    infoPanelOpen,
    muted: meta.isMuted,
    smallTeam: meta.teamType !== 'big',
    teamName: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {onToggleInfoPanel}) => ({
  onBack: () => dispatch(RouteTree.navigateUp()),
  onOpenFolder: () => dispatch(Chat2Gen.createOpenSelectedFolder()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
  onToggleInfoPanel,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeNumber: stateProps.badgeNumber,
  canOpenInfoPanel: stateProps.canOpenInfoPanel,
  channelName: stateProps.channelName,
  infoPanelOpen: stateProps.infoPanelOpen,
  muted: stateProps.muted,
  onBack: dispatchProps.onBack,
  onOpenFolder: dispatchProps.onOpenFolder,
  onShowProfile: dispatchProps.onShowProfile,
  onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
  participants: stateProps._participants.toArray(),
  smallTeam: stateProps.smallTeam,
  teamName: stateProps.teamName,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => !!props.teamName, renderComponent(ChannelHeader))
)(UsernameHeader)
