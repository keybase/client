// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import {type ConversationIDKey} from '../../constants/chat'
import EditChannel from './edit-channel'
import {connect, type TypedState} from '../../util/container'
import {updateChannelName, updateTopic, deleteChannel} from '../../actions/teams/creators'

const mapStateToProps = (state: TypedState, {navigateUp, routePath, routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey') || ''
  const teamname = Constants.getTeamNameFromConvID(state, conversationIDKey) || ''
  const channelName = Constants.getChannelNameFromConvID(state, conversationIDKey) || ''
  const topic = Constants.getTopicFromConvID(state, conversationIDKey) || ''
  const yourRole = Constants.getYourRoleFromConvID(state, conversationIDKey) || 'reader'
  const canDelete = (yourRole && (Constants.isAdmin(yourRole) || Constants.isOwner(yourRole))) || false
  return {
    conversationIDKey,
    teamname,
    channelName,
    topic,
    canDelete,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey')

  return {
    onCancel: () => dispatch(navigateUp()),
    _updateChannelName: (newChannelName: string) =>
      dispatch(updateChannelName(conversationIDKey, newChannelName)),
    _updateTopic: (newTopic: string) => dispatch(updateTopic(conversationIDKey, newTopic)),
    onDelete: () => dispatch(deleteChannel(conversationIDKey)),
  }
}

const mergeProps = (stateProps, dispatchProps, {routeProps}) => {
  const waitingForSave = routeProps.get('waitingForSave')

  const deleteRenameDisabled = stateProps.channelName === 'general'
  return {
    teamname: stateProps.teamname,
    channelName: stateProps.channelName,
    topic: stateProps.topic,
    onCancel: dispatchProps.onCancel,
    onDelete: dispatchProps.onDelete,
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
    waitingForSave,
  }
}
const ConnectedEditChannel: React.ComponentType<{
  navigateUp: Function,
  routeProps: I.RecordOf<{conversationIDKey: ConversationIDKey, waitingForSave: boolean}>,
}> = connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditChannel)
export default ConnectedEditChannel
