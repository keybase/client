// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import {getMeta} from '../../constants/chat2'
import * as TeamsGen from '../../actions/teams-gen'
import {type ConversationIDKey} from '../../constants/types/chat2'
import EditChannel, {type Props} from './edit-channel'
import {connect, type TypedState} from '../../util/container'
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

  const channelInfo =
    Constants.getChannelInfoFromConvID(state, teamname, conversationIDKey) ||
    getMeta(state, conversationIDKey)

  const waitingForGetInfo = anyWaiting(state, Constants.getChannelsWaitingKey(teamname))
  const waitingForUpdate = anyWaiting(
    state,
    Constants.updateTopicWaitingKey(conversationIDKey),
    Constants.updateChannelNameWaitingKey(conversationIDKey)
  )
  const waitingForSave = waitingForGetInfo || waitingForUpdate

  const channelName = channelInfo ? channelInfo.channelname : ''
  const topic = channelInfo ? channelInfo.description : ''
  const yourRole = Constants.getRole(state, teamname)
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  return {
    conversationIDKey,
    teamname,
    channelName,
    topic,
    canDelete,
    waitingForGetInfo,
    waitingForSave,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => {
  return {
    // TODO: Ideally this would dispatch an action to load the data
    // for a particular conversationIDKey. Then we'd be able to remove
    // the dependence on teamname.
    _loadChannels: (teamname: string) => dispatch(TeamsGen.createGetChannels({teamname})),
    _updateChannelName: (teamname: string, conversationIDKey: ConversationIDKey, newChannelName: string) =>
      dispatch(TeamsGen.createUpdateChannelName({teamname, conversationIDKey, newChannelName})),
    _updateTopic: (teamname: string, conversationIDKey: ConversationIDKey, newTopic: string) =>
      dispatch(TeamsGen.createUpdateTopic({teamname, conversationIDKey, newTopic})),
    _onConfirmedDelete: (teamname: string, conversationIDKey: ConversationIDKey) => {
      dispatch(TeamsGen.createDeleteChannelConfirmed({teamname, conversationIDKey}))
      dispatch(navigateUp())
    },
    onCancel: () => dispatch(navigateUp()),
  }
}

const mergeProps = (stateProps, dispatchProps, {routeState}): Props => {
  const {teamname, conversationIDKey, channelName, topic} = stateProps
  const deleteRenameDisabled = channelName === 'general'
  return {
    teamname,
    channelName,
    topic,
    onCancel: dispatchProps.onCancel,
    onConfirmedDelete: () => {
      dispatchProps._onConfirmedDelete(teamname, conversationIDKey)
    },
    showDelete: stateProps.canDelete,
    deleteRenameDisabled,
    _loadChannels: () => dispatchProps._loadChannels(stateProps.teamname),
    onSave: (newChannelName: string, newTopic: string) => {
      if (channelName && !deleteRenameDisabled) {
        if (newChannelName !== channelName) {
          dispatchProps._updateChannelName(teamname, conversationIDKey, newChannelName)
        }

        if (newTopic !== topic) {
          dispatchProps._updateTopic(teamname, conversationIDKey, newTopic)
        }
      }

      dispatchProps.onCancel() // nav back up
    },
    waitingForGetInfo: stateProps.waitingForGetInfo,
    waitingForSave: stateProps.waitingForSave,
  }
}
const ConnectedEditChannel: React.ComponentType<{
  navigateUp: Function,
  routeProps: I.RecordOf<{conversationIDKey: ConversationIDKey, teamname: string}>,
}> = connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditChannel)
export default ConnectedEditChannel
