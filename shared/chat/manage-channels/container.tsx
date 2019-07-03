import {isEqual} from 'lodash-es'
import * as ChatTypes from '../../constants/types/chat2'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {ChannelMembershipState} from '../../constants/types/teams'
import ManageChannels from '.'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import {getChannelsWaitingKey, getCanPerform, getTeamChannelInfos, hasCanPerform} from '../../constants/teams'
import {formatTimeRelativeToNow} from '../../util/timestamp'

type OwnProps = Container.RouteProps<
  {
    teamname: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
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

const mapDispatchToProps = (dispatch, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
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
        RouteTreeGen.createNavigateTo({
          parentPath: [],
          path: [{props: {teamname}, selected: 'chatCreateChannel'}],
        })
      ),
    onEdit: conversationIDKey =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, teamname}, selected: 'chatEditChannel'}],
        })
      ),
  }
}

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  Container.withPropsOnChange(['channels'], (props: any) => ({
    oldChannelState: props.channels.reduce((acc, c) => {
      acc[ChatTypes.conversationIDKeyToString(c.convID)] = c.selected
      return acc
    }, {}),
  })),
  Container.withStateHandlers(
    (props: any) => ({
      nextChannelState: props.oldChannelState,
    }),
    {
      setNextChannelState: () => nextChannelState => ({nextChannelState}),
    }
  ),
  Container.withHandlers({
    onClickChannel: props => (channelname: string) => {
      props._onView(props.oldChannelState, props.nextChannelState, channelname)
    },
    onSaveSubscriptions: props => () =>
      props._saveSubscriptions(props.oldChannelState, props.nextChannelState, props.selectedChatID),
    onToggle: props => (convID: ChatTypes.ConversationIDKey) =>
      props.setNextChannelState({
        ...props.nextChannelState,
        [ChatTypes.conversationIDKeyToString(convID)]: !props.nextChannelState[
          ChatTypes.conversationIDKeyToString(convID)
        ],
      }),
  } as any),
  Container.lifecycle({
    componentDidMount() {
      // @ts-ignore NO recompose
      this.props._loadChannels()
      // @ts-ignore NO recompose
      if (!this.props._hasOperations) {
        // @ts-ignore NO recompose
        this.props._loadOperations()
      }
    },
    componentDidUpdate(prevProps) {
      // @ts-ignore NO recompose
      if (!isEqual(this.props.oldChannelState, prevProps.oldChannelState)) {
        // @ts-ignore NO recompose
        this.props.setNextChannelState(this.props.oldChannelState)
      }
    },
  }),
  Container.withPropsOnChange(['oldChannelState', 'nextChannelState'], (props: any) => ({
    unsavedSubscriptions: !isEqual(props.oldChannelState, props.nextChannelState),
  }))
)(ManageChannels)
