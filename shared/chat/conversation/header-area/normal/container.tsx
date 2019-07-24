import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader, Props} from '.'
import * as Container from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'

type OwnProps = Container.PropsWithSafeNavigation<{
  conversationIDKey: Types.ConversationIDKey
  infoPanelOpen: boolean
  onToggleInfoPanel: () => void
}>

const mapStateToProps = (state: Container.TypedState, {infoPanelOpen, conversationIDKey}: OwnProps) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  const _participants = meta.teamname ? null : meta.participants
  const _contactNames = meta.participantToContactName
  const _displayNames = meta.participantToDisplayName

  return {
    _badgeMap: state.chat2.badgeMap,
    _contactNames,
    _conversationIDKey: conversationIDKey,
    _displayNames,
    _participants,
    channelName: meta.channelname,
    infoPanelOpen,
    muted: meta.isMuted,
    pendingWaiting: conversationIDKey === Constants.pendingWaitingConversationIDKey,
    smallTeam: meta.teamType !== 'big',
    teamName: meta.teamname,
    username: state.config.username,
  }
}

const mapDispatchToProps = (
  dispatch: Container.TypedDispatch,
  {navigateUp, onToggleInfoPanel, conversationIDKey}: OwnProps
) => ({
  _onOpenFolder: () => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
  _onUnMuteConversation: () => dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
  onBack: () => dispatch(navigateUp()),
  onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
  onToggleInfoPanel,
  onToggleThreadSearch: () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
})

const isPhoneOrEmail = (props: Props): boolean =>
  props.participants.length === 2 &&
  props.participants.some(participant => participant.endsWith('@phone') || participant.endsWith('@email'))

const HeaderBranch = (props: Props) => {
  if (props.teamName) {
    return <ChannelHeader {...props} />
  }
  if (isPhoneOrEmail(props)) {
    return <PhoneOrEmailHeader {...props} />
  }
  return <UsernameHeader {...props} />
}

export default Container.withSafeNavigation(
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => ({
    badgeNumber: stateProps._badgeMap.reduce(
      (res, currentValue, currentConvID) =>
        // only show sum of badges that aren't for the current conversation
        currentConvID !== stateProps._conversationIDKey ? res + currentValue : res,
      0
    ),
    channelName: stateProps.channelName,
    contactNames: stateProps._contactNames.toObject(),
    infoPanelOpen: stateProps.infoPanelOpen,
    muted: stateProps.muted,
    onBack: dispatchProps.onBack,
    onOpenFolder: dispatchProps._onOpenFolder,
    onShowProfile: dispatchProps.onShowProfile,
    onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
    onToggleThreadSearch: dispatchProps.onToggleThreadSearch,
    participantToDisplayName: stateProps._displayNames.toObject(),
    participants: (stateProps._participants && stateProps._participants.toArray()) || [],
    pendingWaiting: stateProps.pendingWaiting,
    smallTeam: stateProps.smallTeam,
    teamName: stateProps.teamName,
    unMuteConversation: dispatchProps._onUnMuteConversation,
    username: stateProps.username,
  }))(HeaderBranch)
)
