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
import * as TeamsConstants from '../../constants/teams'
import isEqual from 'lodash/isEqual'
import {makeInsertMatcher} from '../../util/string'
import {memoize} from '../../util/memoize'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}>

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

type Props = {
  onBack?: () => void
  _teamID: Types.TeamID
  selectedChatID: ChatTypes.ConversationIDKey
  _onView: (
    oldChannelState: Types.ChannelMembershipState,
    nextChannelState: Types.ChannelMembershipState,
    teamname: string,
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
  const {_teamID, _onView, _saveSubscriptions, channels, selectedChatID, teamname, ...rest} = p
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
      _onView(oldChannelState, nextChannelState, teamname, channelname)
    },
    [_onView, oldChannelState, nextChannelState, teamname]
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

  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(TeamsGen.createGetChannels({teamID: _teamID}))
  }, [dispatch, _teamID])

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
      teamname={teamname}
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

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', '')
    const waitingKey = TeamsConstants.getChannelsWaitingKey(teamID)
    const waitingForGet = anyWaiting(state, waitingKey)
    const channelInfos = TeamsConstants.getTeamChannelInfos(state, teamID)
    const yourOperations = TeamsConstants.getCanPerformByID(state, teamID)
    const teamname = TeamsConstants.getTeamNameFromID(state, teamID) || ''

    const canEditChannels =
      yourOperations.editChannelDescription || yourOperations.renameChannel || yourOperations.deleteChannel
    const canCreateChannels = yourOperations.createChannel

    const generalCh = [...channelInfos.values()].find(i => i.channelname === 'general')
    const teamSize = generalCh ? generalCh.numParticipants : 0

    const searchText = state.chat2.channelSearchText
    const isFiltered = !!searchText

    const selectedChatID = state.chat2.selectedConversation

    return {
      _teamID: teamID,
      canCreateChannels,
      canEditChannels,
      channels: getChannels(channelInfos, searchText, teamSize),
      isFiltered,
      selectedChatID,
      teamname,
      waitingForGet,
      waitingKey,
    }
  },
  (dispatch, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
    return {
      _onView: (
        oldChannelState: Types.ChannelMembershipState,
        nextChannelState: Types.ChannelMembershipState,
        teamname: string,
        channelname: string
      ) => {
        dispatch(
          TeamsGen.createSaveChannelMembership({
            newChannelState: nextChannelState,
            oldChannelState,
            teamID,
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
            teamID,
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
            path: [{props: {teamID}, selected: 'chatCreateChannel'}],
          })
        ),
      onEdit: (conversationIDKey: ChatTypes.ConversationIDKey) =>
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {conversationIDKey, teamID}, selected: 'chatEditChannel'}],
          })
        ),
    }
  },
  (s, d, _: OwnProps) => ({
    ...s,
    ...d,
  })
)(Wrapper)
