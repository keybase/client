// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
import {type ConversationIDKey} from '../../constants/types/chat2'
import EditChannel from './edit-channel'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'
import {anyWaiting} from '../../constants/waiting'

const mapStateToProps = (state: TypedState, {navigateUp, routePath, routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey')
  const teamname = routeProps.get('teamname')
  const waitingForSave = anyWaiting(
    state,
    `updateTopic:${conversationIDKey}`,
    `updateChannelName:${conversationIDKey}`,
    `getChannels:${teamname}`
  )
  const channelName = Constants.getChannelNameFromConvID(state, conversationIDKey) || ''
  const _needsLoad = !channelName
  const topic = Constants.getTopicFromConvID(state, conversationIDKey) || ''
  const yourRole = Constants.getRole(state, teamname)
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  return {
    _needsLoad,
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
    _loadChannels: (teamname: string) => dispatch(TeamsGen.createGetChannels({teamname})),
    onCancel: () => dispatch(navigateUp()),
    _updateChannelName: (newChannelName: string) =>
      dispatch(TeamsGen.createUpdateChannelName({conversationIDKey, newChannelName})),
    _updateTopic: (newTopic: string) => dispatch(TeamsGen.createUpdateTopic({conversationIDKey, newTopic})),
    onConfirmedDelete: () => {
      dispatch(TeamsGen.createDeleteChannelConfirmed({conversationIDKey}))
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
    _needsLoad: stateProps._needsLoad,
    _loadChannels: () => dispatchProps._loadChannels(stateProps.teamname),
    onSave: (newChannelName: string, newTopic: string) => {
      if (!deleteRenameDisabled) {
        if (newChannelName !== stateProps.channelName) {
          dispatchProps._updateChannelName(newChannelName)
        }
      }

      if (newTopic !== stateProps.topic) {
        dispatchProps._updateTopic(newTopic)
      }

      dispatchProps.onCancel() // nav back up
    },
    waitingForSave: stateProps.waitingForSave,
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
