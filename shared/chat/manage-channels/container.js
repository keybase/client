// @flow
import pickBy from 'lodash/pickBy'
import isEqual from 'lodash/isEqual'
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatGen from '../../actions/chat-gen'
import ManageChannels from '.'
import {withHandlers, withState, withPropsOnChange} from 'recompose'
import {pausableConnect, compose, lifecycle, type TypedState} from '../../util/container'
import {getChannels, saveChannelMembership} from '../../actions/teams/creators'
import {navigateTo, navigateAppend, pathSelector} from '../../actions/route-tree'
import {anyWaiting} from '../../constants/waiting'
import {chatTab} from '../../constants/tabs'
import '../../constants/route-tree'

type ChannelMembershipState = {[channelname: string]: boolean}

const mapStateToProps = (state: TypedState, {routeProps, routeState}) => {
  const teamname = routeProps.get('teamname')
  const waitingForSave = anyWaiting(state, `saveChannel:${teamname}`, `getChannels:${teamname}`)
  const convIDs = state.entities.getIn(['teams', 'teamNameToConvIDs', routeProps.get('teamname')], I.Set())
  const you = state.config.username

  const channels = convIDs
    .map(convID => {
      const info: ?Constants.ChannelInfo = state.entities.getIn(['teams', 'convIDToChannelInfo', convID])

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
    channels,
    teamname: routeProps.get('teamname'),
    waitingForSave,
    currentPath,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    _loadChannels: () => dispatch(getChannels(teamname)),
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
      dispatch(saveChannelMembership(teamname, channelsToChange))
    },
    _onPreview: (conversationIDKey: string, previousPath?: string[]) => {
      dispatch(ChatGen.createPreviewChannel({conversationIDKey}))
      dispatch(
        navigateTo([chatTab, {selected: conversationIDKey, props: {previousPath: previousPath || null}}])
      )
    },
    _onView: (conversationIDKey: string) => {
      dispatch(ChatGen.createSetInboxFilter({filter: ''}))
      dispatch(ChatGen.createSelectConversation({conversationIDKey, fromUser: true}))
    },
  }
}

export default compose(
  pausableConnect(mapStateToProps, mapDispatchToProps),
  withPropsOnChange(['channels'], props => ({
    oldChannelState: props.channels.reduce((acc, c) => {
      acc[c.name] = c.selected
      return acc
    }, {}),
  })),
  withState('nextChannelState', 'setNextChannelState', props => props.oldChannelState),
  withHandlers({
    onToggle: props => (channelname: string) =>
      props.setNextChannelState(cs => ({
        ...cs,
        [channelname]: !cs[channelname],
      })),
    onSaveSubscriptions: props => () =>
      props._saveSubscriptions(props.oldChannelState, props.nextChannelState),
    onClickChannel: ({channels, currentPath, _onPreview, _onView}) => (conversationIDKey: string) => {
      const channel = channels.find(c => c.convID === conversationIDKey)
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
    },
  }),
  withPropsOnChange(['oldChannelState', 'nextChannelState'], props => ({
    unsavedSubscriptions: !isEqual(props.oldChannelState, props.nextChannelState),
  }))
)(ManageChannels)
