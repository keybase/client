// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
import {type ConversationIDKey} from '../../constants/types/chat2'
import EditChannel, {type Props} from './edit-channel'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'
import {anyWaiting} from '../../constants/waiting'

const mapStateToProps = (state: TypedState, {navigateUp, routePath, routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey')
  if (!conversationIDKey) {
    throw new Error('conversationIDKey unexpectedly empty')
  }

  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('teamname unexpectedly empty')
  }

  // We can arrive at this dialog in two ways -- from the manage
  // channels dialog, or from the chat info panel.
  //
  // If from the manage channels, _loadChannels should have already
  // been called, and channelInfo should be non-empty and reasonably
  // up to date.
  //
  // Otherwise, even though we have the info for this channel from
  // chat, it's tricky to keep the team and chat data in sync, (see
  // https://github.com/keybase/client/pull/11891 ) so we just call
  // _loadChannels if channelInfo is empty. Although even if
  // channelInfo is non-empty, it might not be updated; that hasn't
  // been a problem yet, though.

  const channelInfo = Constants.getChannelInfoFromConvID(state, teamname, conversationIDKey)
  const _needsLoad = !channelInfo

  const waitingForGetInfo = _needsLoad || anyWaiting(state, Constants.getChannelsWaitingKey(teamname))

  const channelName = channelInfo ? channelInfo.channelname : ''
  const topic = channelInfo ? channelInfo.description : ''
  const yourRole = Constants.getRole(state, teamname)
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  return {
    _needsLoad,
    conversationIDKey,
    teamname,
    channelName,
    topic,
    canDelete,
    waitingForGetInfo,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => {
  return {
    _loadChannels: (teamname: string) => dispatch(TeamsGen.createGetChannels({teamname})),
    _navigateUp: () => dispatch(navigateUp()),
    _updateChannelName: (teamname: string, conversationIDKey: ConversationIDKey, newChannelName: string) =>
      dispatch(TeamsGen.createUpdateChannelName({teamname, conversationIDKey, newChannelName})),
    _updateTopic: (teamname: string, conversationIDKey: ConversationIDKey, newTopic: string) =>
      dispatch(TeamsGen.createUpdateTopic({teamname, conversationIDKey, newTopic})),
    _onConfirmedDelete: (teamname: string, conversationIDKey: ConversationIDKey) =>
      dispatch(TeamsGen.createDeleteChannelConfirmed({teamname, conversationIDKey})),
  }
}

const mergeProps = (stateProps, dispatchProps, {routeState}): Props => {
  const {teamname, conversationIDKey, channelName, topic} = stateProps
  const deleteRenameDisabled = channelName === 'general'
  return {
    _loadChannels: () => dispatchProps._loadChannels(teamname),
    teamname,
    channelName,
    topic,
    onCancel: dispatchProps._navigateUp,
    onConfirmedDelete: () => {
      dispatchProps._onConfirmedDelete(teamname, conversationIDKey)
      dispatchProps._navigateUp()
    },
    showDelete: stateProps.canDelete,
    deleteRenameDisabled,
    _needsLoad: stateProps._needsLoad,
    onSave: (newChannelName: string, newTopic: string) => {
      if (!deleteRenameDisabled && newChannelName !== channelName) {
        dispatchProps._updateChannelName(teamname, conversationIDKey, newChannelName)
      }

      if (newTopic !== topic) {
        dispatchProps._updateTopic(teamname, conversationIDKey, newTopic)
      }

      dispatchProps._navigateUp()
    },
    waitingForGetInfo: stateProps.waitingForGetInfo,
  }
}

const ConnectedEditChannel: React.ComponentType<{
  navigateUp: Function,
  routeProps: I.RecordOf<{conversationIDKey: ConversationIDKey, teamname: string}>,
  routeState: I.RecordOf<{waitingForSave: number}>,
}> = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidMount() {
      if (this.props._needsLoad) {
        this.props._loadChannels()
      }
    },
  })
)(EditChannel)
export default ConnectedEditChannel
