import * as Chat2Gen from '../../actions/chat2-gen'
import * as ChatTypes from '../../constants/types/chat2'
import * as Container from '../../util/container'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import ManageChannels, {RowProps} from '.'
import {ChannelMembershipState} from '../../constants/types/teams'
import {anyWaiting} from '../../constants/waiting'
import {formatTimeRelativeToNow} from '../../util/timestamp'
import {getChannelsWaitingKey, getCanPerform, getTeamChannelInfos, hasCanPerform} from '../../constants/teams'
import {isEqual} from 'lodash-es'

type OwnProps = Container.RouteProps<{teamname: string}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname', '')
  const waitingKey = getChannelsWaitingKey(teamname)
  const waitingForGet = anyWaiting(state, waitingKey)
  const channelInfos = getTeamChannelInfos(state, teamname)
  const yourOperations = getCanPerform(state, teamname)
  // We can get here without loading team operations
  // if we manage channels on mobile without loading the conversation first
  const _hasOperations = hasCanPerform(state, teamname)

  const canEditChannels =
    yourOperations.editChannelDescription || yourOperations.renameChannel || yourOperations.deleteChannel
  const canCreateChannels = yourOperations.createChannel

  const generalCh = channelInfos.find(i => i.channelname === 'general')
  const teamSize = generalCh ? generalCh.numParticipants : 0

  const channels = channelInfos
    .map((info, convID) => ({
      convID,
      description: info.description,
      hasAllMembers: info.numParticipants === teamSize,
      mtimeHuman: formatTimeRelativeToNow(info.mtime),
      name: info.channelname,
      numParticipants: info.numParticipants,
      selected: info.memberStatus === RPCChatTypes.ConversationMemberStatus.active,
    }))
    .valueSeq()
    .toArray()
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedChatID = state.chat2.selectedConversation

  return {
    _hasOperations,
    canCreateChannels,
    canEditChannels,
    channels,
    selectedChatID,
    teamname,
    waitingForGet,
    waitingKey,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, ownProps: OwnProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname', '')
  return {
    _loadChannels: () => dispatch(TeamsGen.createGetChannels({teamname})),
    _loadOperations: () => dispatch(TeamsGen.createGetTeamOperations({teamname})),
    _onView: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState,
      channelname: string
    ) => {
      dispatch(
        TeamsGen.createSaveChannelMembership({
          newChannelState: nextChannelState,
          oldChannelState,
          teamname,
        })
      )
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(Chat2Gen.createPreviewConversation({channelname, reason: 'manageView', teamname}))
    },
    _saveSubscriptions: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState,
      selectedChatID: ChatTypes.ConversationIDKey
    ) => {
      dispatch(
        TeamsGen.createSaveChannelMembership({
          newChannelState: nextChannelState,
          oldChannelState,
          teamname,
        })
      )
      if (selectedChatID in nextChannelState && !nextChannelState[selectedChatID]) {
        dispatch(
          Container.isMobile
            ? RouteTreeGen.createNavigateUp()
            : Chat2Gen.createNavigateToInbox({avoidConversationID: selectedChatID, findNewConversation: true})
        )
      } else {
        dispatch(RouteTreeGen.createNavigateUp())
      }
    },
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
    onCreate: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {teamname}, selected: 'chatCreateChannel'}],
        })
      ),
    onEdit: (conversationIDKey: ChatTypes.ConversationIDKey) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, teamname}, selected: 'chatEditChannel'}],
        })
      ),
  }
}

type Props = {
  onBack?: () => void
  selectedChatID: ChatTypes.ConversationIDKey
  _hasOperations: () => void
  _loadChannels: () => void
  _loadOperations: () => void
  _onView: (
    oldChannelState: ChannelMembershipState,
    nextChannelState: ChannelMembershipState,
    channelname: string
  ) => void
  _saveSubscriptions: (
    oldChannelState: ChannelMembershipState,
    nextChannelState: ChannelMembershipState,
    selectedChatID: ChatTypes.ConversationIDKey
  ) => void
  canCreateChannels: boolean
  canEditChannels: boolean
  channels: Array<RowProps & {convID: ChatTypes.ConversationIDKey}>
  onClose: () => void
  onCreate: () => void
  onEdit: (convID: ChatTypes.ConversationIDKey) => void
  teamname: string
  waitingForGet: boolean
  waitingKey: string
}

const Wrapper = (p: Props) => {
  const {
    _hasOperations,
    _loadOperations,
    _loadChannels,
    _onView,
    _saveSubscriptions,
    channels,
    selectedChatID,
    ...rest
  } = p
  const oldChannelState = React.useMemo(
    () =>
      channels.reduce<{[key: string]: boolean}>((acc, c) => {
        acc[ChatTypes.conversationIDKeyToString(c.convID)] = c.selected
        return acc
      }, {}),
    [channels]
  )

  const [nextChannelState, setNextChannelState] = React.useState<ChannelMembershipState>(oldChannelState)

  const onClickChannel = React.useCallback(
    (channelname: string) => {
      _onView(oldChannelState, nextChannelState, channelname)
    },
    [_onView, oldChannelState, nextChannelState]
  )

  const onSaveSubscriptions = React.useCallback(() => {
    _saveSubscriptions(oldChannelState, nextChannelState, selectedChatID)
  }, [_saveSubscriptions, oldChannelState, nextChannelState, selectedChatID])

  const onToggle = React.useCallback(
    (convID: ChatTypes.ConversationIDKey) => {
      setNextChannelState({
        ...nextChannelState,
        [ChatTypes.conversationIDKeyToString(convID)]: !nextChannelState[
          ChatTypes.conversationIDKeyToString(convID)
        ],
      })
    },
    [setNextChannelState, nextChannelState]
  )

  React.useEffect(() => {
    _loadChannels()
    !_hasOperations && _loadOperations()
    // eslint-disable-next-line
  }, [])

  const prevOldChannelState = Container.usePrevious(oldChannelState)
  React.useEffect(() => {
    if (!isEqual(oldChannelState, prevOldChannelState)) {
      setNextChannelState(oldChannelState)
    }
  }, [prevOldChannelState, oldChannelState])

  const unsavedSubscriptions = React.useMemo(() => !isEqual(oldChannelState, nextChannelState), [
    oldChannelState,
    nextChannelState,
  ])

  return (
    <ManageChannels
      onBack={rest.onBack}
      waitingKey={rest.waitingKey}
      waitingForGet={rest.waitingForGet}
      teamname={rest.teamname}
      onEdit={rest.onEdit}
      onClose={rest.onClose}
      onCreate={rest.onCreate}
      canEditChannels={rest.canEditChannels}
      canCreateChannels={rest.canCreateChannels}
      channels={channels}
      nextChannelState={nextChannelState}
      onClickChannel={onClickChannel}
      onSaveSubscriptions={onSaveSubscriptions}
      onToggle={onToggle}
      unsavedSubscriptions={unsavedSubscriptions}
    />
  )
}

const C = Container.connect(mapStateToProps, mapDispatchToProps, (s, d, _: OwnProps) => ({
  ...s,
  ...d,
}))(Wrapper)

// TODO fix this broken type
export default C as any
