// @flow
import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {ChannelHeader, UsernameHeader} from '.'
import {branch, compose, renderComponent, connect} from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isPending: boolean,
  infoPanelOpen: boolean,
  onToggleInfoPanel: () => void,
|}

const mapStateToProps = (state, {infoPanelOpen, conversationIDKey, isPending}) => {
  let meta = Constants.getMeta(state, conversationIDKey)
  if (isPending) {
    const resolved = Constants.getResolvedPendingConversationIDKey(state)
    if (Constants.isValidConversationIDKey(resolved)) {
      meta = Constants.getMeta(state, resolved)
    }
  }
  const _participants = meta.teamname ? I.Set() : meta.participants

  return {
    _badgeMap: state.chat2.badgeMap,
    _conversationIDKey: conversationIDKey,
    _participants,
    channelName: meta.channelname,
    infoPanelOpen,
    isPending,
    muted: meta.isMuted,
    smallTeam: meta.teamType !== 'big',
    teamName: meta.teamname,
  }
}

const mapDispatchToProps = (dispatch, {onToggleInfoPanel, conversationIDKey}) => ({
  _onCancel: () => dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
  _onOpenFolder: () => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
  _onUnMuteConversation: () => dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
  onToggleInfoPanel,
})

const mergeProps = (stateProps, dispatchProps) => ({
  badgeNumber: stateProps._badgeMap.reduce(
    (res, currentValue, currentConvID) =>
      // only show sum of badges that aren't for the current conversation
      currentConvID !== stateProps._conversationIDKey ? res + currentValue : res,
    0
  ),
  canOpenInfoPanel: !stateProps.isPending,
  channelName: stateProps.channelName,
  infoPanelOpen: stateProps.infoPanelOpen,
  muted: stateProps.muted,
  onBack: dispatchProps.onBack,
  onCancelPending: stateProps.isPending ? dispatchProps._onCancel : null,
  onOpenFolder: stateProps.isPending ? null : dispatchProps._onOpenFolder,
  onShowProfile: dispatchProps.onShowProfile,
  onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
  participants: stateProps._participants.toArray(),
  smallTeam: stateProps.smallTeam,
  teamName: stateProps.teamName,
  unMuteConversation: dispatchProps._onUnMuteConversation,
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  branch(props => !!props.teamName, renderComponent(ChannelHeader))
)(UsernameHeader)
