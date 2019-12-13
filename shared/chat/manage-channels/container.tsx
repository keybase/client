import * as Chat2Gen from '../../actions/chat2-gen'
import * as ChatTypes from '../../constants/types/chat2'
import * as Container from '../../util/container'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamsGen from '../../actions/teams-gen'
import ManageChannels, {RowProps} from '.'
import * as Types from '../../constants/types/teams'
import {anyWaiting} from '../../constants/waiting'
import {formatTimeRelativeToNow} from '../../util/timestamp'
import {getChannelsWaitingKey, getCanPerform, getTeamChannelInfos} from '../../constants/teams'
import isEqual from 'lodash/isEqual'
import {makeInsertMatcher} from '../../util/string'
import {memoize} from '../../util/memoize'

type OwnProps = Container.RouteProps<{teamname: string}>

const getChannels = memoize(
  (channelInfos: Map<string, Types.ChannelInfo>, searchText: string, teamSize: number) =>
    [...channelInfos.entries()]
      .map(([convID, info]) => ({
        convID,
        description: info.description,
        hasAllMembers: info.numParticipants === teamSize,
        mtimeHuman: formatTimeRelativeToNow(info.mtime),
        name: info.channelname,
        numParticipants: info.numParticipants,
        selected: info.memberStatus === RPCChatTypes.ConversationMemberStatus.active,
      }))
      .filter(conv => {
        if (!searchText) {
          return true // no search text means show all
        }
        return (
          // match channel name for search as subsequence (like the identity modal)
          // match channel desc by strict substring (less noise in results)
          conv.name.match(makeInsertMatcher(searchText)) ||
          conv.description.match(new RegExp(searchText, 'i'))
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
)

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname', '')
  const waitingKey = getChannelsWaitingKey(teamname)
  const waitingForGet = anyWaiting(state, waitingKey)
  const channelInfos = getTeamChannelInfos(state, teamname)
  const yourOperations = getCanPerform(state, teamname)

  const canEditChannels =
    yourOperations.editChannelDescription || yourOperations.renameChannel || yourOperations.deleteChannel
  const canCreateChannels = yourOperations.createChannel

  const generalCh = [...channelInfos.values()].find(i => i.channelname === 'general')
  const teamSize = generalCh ? generalCh.numParticipants : 0

  const searchText = state.chat2.channelSearchText
  const isFiltered = !!searchText

  const selectedChatID = state.chat2.selectedConversation

  return {
    canCreateChannels,
    canEditChannels,
    channels: getChannels(channelInfos, searchText, teamSize),
    isFiltered,
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
    _onView: (
      oldChannelState: Types.ChannelMembershipState,
      nextChannelState: Types.ChannelMembershipState,
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
      oldChannelState: Types.ChannelMembershipState,
      nextChannelState: Types.ChannelMembershipState,
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
        dispatch(Container.isMobile ? RouteTreeGen.createNavigateUp() : Chat2Gen.createNavigateToInbox())
      } else {
        dispatch(RouteTreeGen.createNavigateUp())
      }
    },
    onBack: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(Chat2Gen.createSetChannelSearchText({text: ''}))
    },
    onChangeSearch: (text: string) => dispatch(Chat2Gen.createSetChannelSearchText({text})),
    onClose: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(Chat2Gen.createSetChannelSearchText({text: ''}))
    },
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
  _loadChannels: () => void
  _onView: (
    oldChannelState: Types.ChannelMembershipState,
    nextChannelState: Types.ChannelMembershipState,
    channelname: string
  ) => void
  _saveSubscriptions: (
    oldChannelState: Types.ChannelMembershipState,
    nextChannelState: Types.ChannelMembershipState,
    selectedChatID: ChatTypes.ConversationIDKey
  ) => void
  canCreateChannels: boolean
  canEditChannels: boolean
  channels: Array<RowProps & {convID: ChatTypes.ConversationIDKey}>
  isFiltered: boolean
  onChangeSearch: (text: string) => void
  onClose: () => void
  onCreate: () => void
  onEdit: (convID: ChatTypes.ConversationIDKey) => void
  teamname: string
  waitingForGet: boolean
  waitingKey: string
}

const Wrapper = (p: Props) => {
  const {_loadChannels, _onView, _saveSubscriptions, channels, selectedChatID, ...rest} = p
  const oldChannelState = React.useMemo(
    () =>
      channels.reduce<{[key: string]: boolean}>((acc, c) => {
        acc[ChatTypes.conversationIDKeyToString(c.convID)] = c.selected
        return acc
      }, {}),
    [channels]
  )

  const [nextChannelState, setNextChannelState] = React.useState<Types.ChannelMembershipState>(
    oldChannelState
  )

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
      onChangeSearch={rest.onChangeSearch}
      onClose={rest.onClose}
      onCreate={rest.onCreate}
      canEditChannels={rest.canEditChannels}
      isFiltered={rest.isFiltered}
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
