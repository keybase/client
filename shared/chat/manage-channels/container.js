// @flow
import logger from '../../logger'
import pickBy from 'lodash/pickBy'
import isEqual from 'lodash/isEqual'
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
import {navigateTo, navigateAppend, pathSelector, switchTo} from '../../actions/route-tree'
import {anyWaiting} from '../../constants/waiting'
import {chatTab} from '../../constants/tabs'
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

  const currentPath = pathSelector(state)

  return {
    _hasOperations,
    canCreateChannels,
    canEditChannels,
    channels,
    teamname: routeProps.get('teamname'),
    waitingForSave,
    currentPath,
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
      dispatch(navigateAppend([{selected: 'editChannel', props: {conversationIDKey}}])),
    onCreate: () =>
      dispatch(navigateTo([{selected: 'createChannel', props: {teamname}}], routePath.butLast())),
    _saveSubscriptions: (
      oldChannelState: ChannelMembershipState,
      nextChannelState: ChannelMembershipState
    ) => {
      const channelsToChange = pickBy(
        nextChannelState,
        (inChannel: boolean, channelname: string) => inChannel !== oldChannelState[channelname]
      )
      dispatch(TeamsGen.createSaveChannelMembership({teamname, channelState: channelsToChange}))
    },
    _onPreview: (conversationIDKey: ChatTypes.ConversationIDKey, previousPath?: string[]) => {
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'preview'}))
      dispatch(
        navigateTo([
          chatTab,
          {
            selected: ChatTypes.conversationIDKeyToString(conversationIDKey),
            props: {previousPath: previousPath || null},
          },
        ])
      )
    },
    _onView: (conversationIDKey: ChatTypes.ConversationIDKey) => {
      dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'manageView'}))
      dispatch(switchTo([chatTab]))
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
    onClickChannel: ({channels, currentPath, _onPreview, _onView}) => (conversationIDKey: string) => {
      const channel = channels.find(c => c.convID === conversationIDKey)
      if (!channel) {
        logger.warn('Attempted to navigate to a conversation ID that was not found in the channel list')
        return
      }
      if (channel.selected) {
        _onView(conversationIDKey)
      } else {
        _onPreview(conversationIDKey, currentPath)
      }
    },
  }),
  lifecycle({
    componentWillReceiveProps: function(nextProps) {
      if (!isEqual(this.props.oldChannelState, nextProps.oldChannelState)) {
        nextProps.setNextChannelState(nextProps.oldChannelState)
      }
    },
    componentDidMount: function() {
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
