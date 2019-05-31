import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {ChannelHeader, UsernameHeader} from '.'
import * as Container from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'

type OwnProps = Container.PropsWithSafeNavigation<{
  conversationIDKey: Types.ConversationIDKey
  infoPanelOpen: boolean
  onToggleInfoPanel: () => void
}>

const mapStateToProps = (state, {infoPanelOpen, conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const _participants = meta.teamname ? I.Set() : meta.participants

  return {
    _badgeMap: state.chat2.badgeMap,
    _conversationIDKey: conversationIDKey,
    _participants,
    channelName: meta.channelname,
    infoPanelOpen,
    muted: meta.isMuted,
    pendingWaiting: conversationIDKey === Constants.pendingWaitingConversationIDKey,
    smallTeam: meta.teamType !== 'big',
    teamName: meta.teamname,
  }
}

const mapDispatchToProps = (
  dispatch,
  {navigateUp, onToggleInfoPanel, onToggleThreadSearch, conversationIDKey}
) => ({
  _onOpenFolder: () => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
  _onUnMuteConversation: () => dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
  onBack: () => dispatch(navigateUp()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
  onToggleInfoPanel,
  onToggleThreadSearch: () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  badgeNumber: stateProps._badgeMap.reduce(
    (res, currentValue, currentConvID) =>
      // only show sum of badges that aren't for the current conversation
      currentConvID !== stateProps._conversationIDKey ? res + currentValue : res,
    0
  ),
  channelName: stateProps.channelName,
  infoPanelOpen: stateProps.infoPanelOpen,
  muted: stateProps.muted,
  onBack: dispatchProps.onBack,
  onOpenFolder: dispatchProps._onOpenFolder,
  onShowProfile: dispatchProps.onShowProfile,
  onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
  onToggleThreadSearch: dispatchProps.onToggleThreadSearch,
  participants: stateProps._participants.toArray(),
  pendingWaiting: stateProps.pendingWaiting,
  smallTeam: stateProps.smallTeam,
  teamName: stateProps.teamName,
  unMuteConversation: dispatchProps._onUnMuteConversation,
})

export default Container.compose(
  Container.withSafeNavigation,
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  // @ts-ignore
  Container.branch(props => !!props.teamName, Container.renderComponent(ChannelHeader))
)(UsernameHeader) as any
