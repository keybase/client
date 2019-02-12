// @flow
import {isEqual} from 'lodash-es'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {type ChannelMembershipState} from '../../constants/types/teams'
import ManageChannels from '.'
import {
  connect,
  compose,
  lifecycle,
  withHandlers,
  withStateHandlers,
  withPropsOnChange,
  type RouteProps,
} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {getPath} from '../../route-tree'
import {anyWaiting} from '../../constants/waiting'
import {getChannelsWaitingKey, getCanPerform, getTeamChannelInfos, hasCanPerform} from '../../constants/teams'
import * as Tabs from '../../constants/tabs'

type OwnProps = RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, {routeProps, routeState}) => {
  const teamname = routeProps.get('teamname')
  const waitingKey = getChannelsWaitingKey(teamname)
  const waitingForGet = anyWaiting(state, waitingKey)
  const channelInfos = getTeamChannelInfos(state, teamname)
  const you = state.config.username
  const yourOperations = getCanPerform(state, teamname)
  // We can get here without loading team operations
  // if we manage channels on mobile without loading the conversation first
  const _hasOperations = hasCanPerform(state, teamname)

  const canEditChannels =
    yourOperations.editChannelDescription || yourOperations.renameChannel || yourOperations.deleteChannel
  const canCreateChannels = yourOperations.createChannel

  const channels = channelInfos
    .map((info, convID) => ({
      convID,
      description: info.description,
      name: info.channelname,
      selected: you && info.participants.has(you),
    }))
    .valueSeq()
    .toArray()
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedConversation = state.chat2.selectedConversation
  const routePath = getPath(state.routeTree.routeState)
  const chatTabSelected = routePath.get(0) === Tabs.chatTab
  const selectedChatID = chatTabSelected ? selectedConversation : ChatConstants.noConversationIDKey

  return {
    _hasOperations,
    _you: you,
    canCreateChannels,
    canEditChannels,
    channels,
    selectedChatID,
    teamname,
    waitingForGet,
    waitingKey,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routePath, routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    _loadChannels: () => dispatch(TeamsGen.createGetChannels({teamname})),
    _loadOperations: () => dispatch(TeamsGen.createGetTeamOperations({teamname})),
    _onView: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState,
      you: string,
      channelname: string
    ) => {
      dispatch(
        TeamsGen.createSaveChannelMembership({
          newChannelState: nextChannelState,
          oldChannelState,
          teamname,
          you,
        })
      )
      dispatch(navigateUp())
      dispatch(Chat2Gen.createPreviewConversation({channelname, reason: 'manageView', teamname}))
    },
    _saveSubscriptions: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState,
      you: string,
      selectedChatID: ChatTypes.ConversationIDKey
    ) => {
      dispatch(
        TeamsGen.createSaveChannelMembership({
          newChannelState: nextChannelState,
          oldChannelState,
          teamname,
          you,
        })
      )
      selectedChatID in nextChannelState && !nextChannelState[selectedChatID]
        ? dispatch(
            Chat2Gen.createNavigateToInbox({avoidConversationID: selectedChatID, findNewConversation: true})
          )
        : dispatch(navigateUp())
    },
    onBack: () => dispatch(navigateUp()),
    onClose: () => dispatch(navigateUp()),
    onCreate: () =>
      dispatch(
        RouteTreeGen.createNavigateTo({
          parentPath: routePath.butLast(),
          path: [{props: {teamname}, selected: 'createChannel'}],
        })
      ),
    onEdit: conversationIDKey =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, teamname}, selected: 'editChannel'}],
        })
      ),
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withPropsOnChange(['channels'], props => ({
    oldChannelState: props.channels.reduce((acc, c) => {
      acc[ChatTypes.conversationIDKeyToString(c.convID)] = c.selected
      return acc
    }, {}),
  })),
  withStateHandlers(
    props => ({
      nextChannelState: props.oldChannelState,
    }),
    {
      setNextChannelState: () => nextChannelState => ({nextChannelState}),
    }
  ),
  withHandlers({
    onClickChannel: props => (channelname: string) => {
      props._onView(props.oldChannelState, props.nextChannelState, props._you, channelname)
    },
    onSaveSubscriptions: props => () =>
      props._saveSubscriptions(
        props.oldChannelState,
        props.nextChannelState,
        props._you,
        props.selectedChatID
      ),
    onToggle: props => (convID: ChatTypes.ConversationIDKey) =>
      props.setNextChannelState({
        ...props.nextChannelState,
        [ChatTypes.conversationIDKeyToString(convID)]: !props.nextChannelState[
          ChatTypes.conversationIDKeyToString(convID)
        ],
      }),
  }),
  lifecycle({
    componentDidMount() {
      this.props._loadChannels()
      if (!this.props._hasOperations) {
        this.props._loadOperations()
      }
    },
    componentDidUpdate(prevProps) {
      if (!isEqual(this.props.oldChannelState, prevProps.oldChannelState)) {
        this.props.setNextChannelState(this.props.oldChannelState)
      }
    },
  }),
  withPropsOnChange(['oldChannelState', 'nextChannelState'], props => ({
    unsavedSubscriptions: !isEqual(props.oldChannelState, props.nextChannelState),
  }))
)(ManageChannels)
