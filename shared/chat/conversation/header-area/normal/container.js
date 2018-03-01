// @flow
import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
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
  const meta = Constants.getMeta(state, conversationIDKey)
  let _participants
  if (state.chat2.pendingSelected) {
    _participants = state.chat2.pendingConversationUsers.toSet()
  } else {
    _participants = meta.teamname ? I.Set() : meta.participants
  }
  return {
    _conversationIDKey: conversationIDKey,
    _participants,
    badgeNumber: state.notifications.getIn(['navBadges', chatTab]),
    canOpenInfoPanel: !state.chat2.pendingSelected,
    channelName: meta.channelname,
    infoPanelOpen,
    muted: meta.isMuted,
    smallTeam: meta.teamType !== 'big',
    teamName: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {onToggleInfoPanel}) => ({
  _onOpenFolder: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
  onBack: () => dispatch(RouteTree.navigateUp()),
  onDebugDump: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createDebugDump({conversationIDKey})),
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
  onDebugDump: () => dispatchProps.onDebugDump(stateProps._conversationIDKey),
  onOpenFolder: () => dispatchProps._onOpenFolder(stateProps._conversationIDKey),
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
