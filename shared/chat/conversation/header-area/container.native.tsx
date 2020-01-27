import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {ChannelHeader, UsernameHeader, PhoneOrEmailHeader, Props} from './index.native'
import * as Container from '../../../util/container'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {getVisiblePath} from '../../../constants/router2'
import {getFullname} from '../../../constants/users'
import * as Tabs from '../../../constants/tabs'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const isPhoneOrEmail = (props: Props): boolean =>
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

export default Container.connect(
  (state, {conversationIDKey}: OwnProps) => {
    const meta = Constants.getMeta(state, conversationIDKey)
    const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const participants = meta.teamname ? null : participantInfo.name
    const contactNames = participantInfo.contactName
    const theirFullname =
      participants?.length === 2
        ? participants
            .filter(username => username !== state.config.username)
            .map(username => getFullname(state, username))[0]
        : undefined

    return {
      _badgeMap: state.chat2.badgeMap,
      channelName: meta.channelname,
      contactNames,
      muted: meta.isMuted,
      participants,
      pendingWaiting:
        conversationIDKey === Constants.pendingWaitingConversationIDKey ||
        conversationIDKey === Constants.pendingErrorConversationIDKey,
      smallTeam: meta.teamType !== 'big',
      teamName: meta.teamname,
      theirFullname,
    }
  },
  (dispatch: Container.TypedDispatch, {conversationIDKey}: OwnProps) => ({
    onOpenFolder: () => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
    onShowInfoPanel: () => dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true})),
    onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
    onToggleThreadSearch: () => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    unMuteConversation: () => dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {conversationIDKey} = ownProps
    const {_badgeMap} = stateProps
    const {
      channelName,
      contactNames,
      muted,
      participants,
      pendingWaiting,
      smallTeam,
      teamName,
      theirFullname,
    } = stateProps
    const {onOpenFolder, onShowProfile, onShowInfoPanel} = dispatchProps
    const {onToggleThreadSearch, unMuteConversation} = dispatchProps
    const visiblePath = getVisiblePath()
    const onTopOfInbox = visiblePath?.length === 4 && visiblePath[2]?.routeName === Tabs.chatTab
    return {
      badgeNumber: onTopOfInbox
        ? [..._badgeMap.entries()].reduce(
            (res, [currentConvID, currentValue]) =>
              // only show sum of badges that aren't for the current conversation
              currentConvID !== conversationIDKey ? res + currentValue : res,
            0
          )
        : 0,
      channelName,
      contactNames,
      muted,
      onOpenFolder,
      onShowInfoPanel,
      onShowProfile,
      onToggleThreadSearch,
      participants: participants || [],
      pendingWaiting,
      smallTeam,
      teamName,
      theirFullname,
      unMuteConversation,
    }
  }
)(HeaderBranch)
