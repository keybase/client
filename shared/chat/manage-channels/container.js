// @flow
import {isEqual} from 'lodash-es'
import * as ChatTypes from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamsGen from '../../actions/teams-gen'
import {type ChannelMembershipState} from '../../constants/types/teams'
import ManageChannels from '.'
import {
  connect,
  compose,
  lifecycle,
  type TypedState,
  withHandlers,
  withStateHandlers,
  withPropsOnChange,
} from '../../util/container'
import {navigateTo, navigateAppend} from '../../actions/route-tree'
import {anyWaiting} from '../../constants/waiting'
import {getChannelsWaitingKey, getCanPerform, getTeamChannelInfos, hasCanPerform} from '../../constants/teams'

const mapStateToProps = (state: TypedState, {routeProps, routeState}) => {
  const teamname = routeProps.get('teamname')
  const waitingForGet = anyWaiting(state, getChannelsWaitingKey(teamname))
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
      description: info.description,
      convID,
      name: info.channelname,
      selected: you && info.participants.has(you),
    }))
    .valueSeq()
    .toArray()
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    _hasOperations,
    _you: you,
    canCreateChannels,
    canEditChannels,
    channels,
    teamname,
    waitingForGet,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    _loadOperations: () => dispatch(TeamsGen.createGetTeamOperations({teamname})),
    _loadChannels: () => dispatch(TeamsGen.createGetChannels({teamname})),
    onBack: () => dispatch(navigateUp()),
    onClose: () => dispatch(navigateUp()),
    onEdit: conversationIDKey =>
      dispatch(navigateAppend([{selected: 'editChannel', props: {conversationIDKey, teamname}}])),
    onCreate: () =>
      dispatch(navigateTo([{selected: 'createChannel', props: {teamname}}], routePath.butLast())),
    _saveSubscriptions: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState,
      you: string
    ) => {
      dispatch(
        TeamsGen.createSaveChannelMembership({
          teamname,
          oldChannelState,
          newChannelState: nextChannelState,
          you,
        })
      )
      dispatch(navigateUp())
    },
    _onView: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState,
      you: string,
      conversationIDKey: ChatTypes.ConversationIDKey
    ) => {
      dispatch(
        TeamsGen.createSaveChannelMembership({
          teamname,
          oldChannelState,
          newChannelState: nextChannelState,
          you,
        })
      )
      const selected = nextChannelState[conversationIDKey]
      dispatch(
        Chat2Gen.createSelectConversation({conversationIDKey, reason: selected ? 'manageView' : 'preview'})
      )
      dispatch(navigateUp())
    },
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withPropsOnChange(['channels'], props => ({
    oldChannelState: props.channels.reduce((acc, c) => {
      acc[c.convID] = c.selected
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
    onToggle: props => (convID: ChatTypes.ConversationIDKey) =>
      props.setNextChannelState({
        ...props.nextChannelState,
        [convID]: !props.nextChannelState[convID],
      }),
    onSaveSubscriptions: props => () =>
      props._saveSubscriptions(props.oldChannelState, props.nextChannelState, props._you),
    onClickChannel: props => (conversationIDKey: string) => {
      props._onView(props.oldChannelState, props.nextChannelState, props._you, conversationIDKey)
    },
  }),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (!isEqual(this.props.oldChannelState, prevProps.oldChannelState)) {
        this.props.setNextChannelState(this.props.oldChannelState)
      }
    },
    componentDidMount() {
      this.props._loadChannels()
      if (!this.props._hasOperations) {
        this.props._loadOperations()
      }
    },
  }),
  withPropsOnChange(['oldChannelState', 'nextChannelState'], props => ({
    unsavedSubscriptions: !isEqual(props.oldChannelState, props.nextChannelState),
  }))
)(ManageChannels)
