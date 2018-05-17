// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
import {type ConversationIDKey} from '../../constants/types/chat2'
import EditChannel, {type Props} from './edit-channel'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {navigateUp, routePath, routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey')
  if (!conversationIDKey) {
    throw new Error('conversationIDKey unexpectedly empty')
  }

  const teamname = routeProps.get('teamname')
  if (!teamname) {
    throw new Error('teamname unexpectedly empty')
  }

  const {channelName, topic} = Constants.getChannelNameAndTopicFromConvID(state, teamname, conversationIDKey)
  const yourRole = Constants.getRole(state, teamname)
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  return {
    canDelete,
    channelName,
    conversationIDKey,
    teamname,
    topic,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => {
  return {
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
    onSave: (newChannelName: string, newTopic: string) => {
      if (!deleteRenameDisabled && newChannelName !== channelName) {
        dispatchProps._updateChannelName(teamname, conversationIDKey, newChannelName)
      }

      if (newTopic !== topic) {
        dispatchProps._updateTopic(teamname, conversationIDKey, newTopic)
      }

      dispatchProps._navigateUp()
    },
  }
}
const ConnectedEditChannel: React.ComponentType<{
  navigateUp: Function,
  routeProps: I.RecordOf<{conversationIDKey: ConversationIDKey, teamname: string}>,
}> = connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditChannel)
export default ConnectedEditChannel
