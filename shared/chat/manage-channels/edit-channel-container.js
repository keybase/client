// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import {type ConversationIDKey} from '../../constants/types/chat'
import EditChannel from './edit-channel'
import {connect, type TypedState} from '../../util/container'
import {updateChannelName, updateTopic, deleteChannelConfirmed} from '../../actions/teams/creators'
import {anyWaiting} from '../../constants/waiting'

const mapStateToProps = (state: TypedState, {navigateUp, routePath, routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey') || ''
  const teamname = Constants.getTeamNameFromConvID(state, conversationIDKey) || ''
  const waitingForSave = anyWaiting(
    state,
    `updateTopic:${conversationIDKey}`,
    `updateChannelName:${conversationIDKey}`,
    `getChannels:${teamname}`
  )
  const channelName = Constants.getChannelNameFromConvID(state, conversationIDKey) || ''
  const topic = Constants.getTopicFromConvID(state, conversationIDKey) || ''
  const yourRole = Constants.getRole(state, teamname) || 'reader'
  const canDelete = (yourRole && (Constants.isAdmin(yourRole) || Constants.isOwner(yourRole))) || false
  return {
    conversationIDKey,
    teamname,
    channelName,
    topic,
    canDelete,
    waitingForSave,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey')

  return {
    onCancel: () => dispatch(navigateUp()),
    _updateChannelName: (newChannelName: string) =>
      dispatch(updateChannelName(conversationIDKey, newChannelName)),
    _updateTopic: (newTopic: string) => dispatch(updateTopic(conversationIDKey, newTopic)),
    onConfirmedDelete: () => {
      dispatch(deleteChannelConfirmed(conversationIDKey))
      dispatch(navigateUp())
    },
  }
}

const mergeProps = (stateProps, dispatchProps, {routeState}) => {
  const deleteRenameDisabled = stateProps.channelName === 'general'
  return {
    teamname: stateProps.teamname,
    channelName: stateProps.channelName,
    topic: stateProps.topic,
    onCancel: dispatchProps.onCancel,
    onConfirmedDelete: dispatchProps.onConfirmedDelete,
    showDelete: stateProps.canDelete,
    deleteRenameDisabled,
    onSave: (newChannelName: string, newTopic: string) => {
      if (!deleteRenameDisabled) {
        if (newChannelName !== stateProps.channelName) {
          dispatchProps._updateChannelName(newChannelName)
        }
      }

      if (newTopic !== stateProps.topic) {
        dispatchProps._updateTopic(newTopic)
      }
    },
    waitingForSave: stateProps.waitingForSave,
  }
}
const ConnectedEditChannel: React.ComponentType<{
  navigateUp: Function,
  routeProps: I.RecordOf<{conversationIDKey: ConversationIDKey}>,
  routeState: I.RecordOf<{waitingForSave: number}>,
}> = connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditChannel)
export default ConnectedEditChannel
