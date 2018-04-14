// @flow
import logger from '../../logger'
import {isEqual, pickBy} from 'lodash-es'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamsGen from '../../actions/teams-gen'
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
import {
  getCanPerform,
  getConvIdsFromTeamName,
  getChannelInfoFromConvID,
  hasCanPerform,
} from '../../constants/teams'
import '../../constants/route-tree'

type ChannelMembershipState = {[channelname: string]: boolean}

const mapStateToProps = (state: TypedState, {routeProps, routeState}) => {
  const teamname = routeProps.get('teamname')
  const waitingForSave = anyWaiting(state, `saveChannel:${teamname}`, `getChannels:${teamname}`)
  const convIDs = getConvIdsFromTeamName(state, teamname)
  const you = state.config.username
  const yourOperations = getCanPerform(state, teamname)
  // We can get here without loading team operations
  // if we manage channels on mobile without loading the conversation first
  const _hasOperations = hasCanPerform(state, teamname)

  const canEditChannels =
    yourOperations.editChannelDescription || yourOperations.renameChannel || yourOperations.deleteChannel
  const canCreateChannels = yourOperations.createChannel

  const channels = convIDs
    .map(convID => {
      const info: ?Types.ChannelInfo = getChannelInfoFromConvID(state, convID)

      return info && info.channelname
        ? {
            description: info.description,
            convID,
            name: info.channelname,
            selected: you && !!info.participants.get(you),
          }
        : null
    })
    .toArray()
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    _hasOperations,
    canCreateChannels,
    canEditChannels,
    channels,
    teamname: routeProps.get('teamname'),
    waitingForSave,
  }
}

const createSaveChannelMembership = (
  teamname: string,
  oldChannelState: ChannelMembershipState,
  nextChannelState: ChannelMembershipState
) => {
  const channelsToChange = pickBy(
    nextChannelState,
    (inChannel: boolean, channelname: string) => inChannel !== oldChannelState[channelname]
  )
  return TeamsGen.createSaveChannelMembership({teamname, channelState: channelsToChange})
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
      nextChannelState: ChannelMembershipState
    ) => {
      dispatch(createSaveChannelMembership(teamname, oldChannelState, nextChannelState))
      dispatch(navigateUp())
    },
    _onView: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState,
      channel: string,
      conversationIDKey: ChatTypes.ConversationIDKey
    ) => {
      const selected = nextChannelState[channel]
      dispatch(createSaveChannelMembership(teamname, oldChannelState, nextChannelState))
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
      acc[c.name] = c.selected
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
    onToggle: props => (channelname: string) =>
      props.setNextChannelState({
        ...props.nextChannelState,
        [channelname]: !props.nextChannelState[channelname],
      }),
    onSaveSubscriptions: props => () =>
      props._saveSubscriptions(props.oldChannelState, props.nextChannelState),
    onClickChannel: props => (conversationIDKey: string) => {
      const channel = props.channels.find(c => c.convID === conversationIDKey)
      if (!channel) {
        logger.warn('Attempted to navigate to a conversation ID that was not found in the channel list')
        return
      }
      props._onView(props.oldChannelState, props.nextChannelState, channel, conversationIDKey)
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
