import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/chat2'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EditChannel from './edit-channel'
import * as Container from '../../util/container'
import {upperFirst} from 'lodash-es'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey; teamname: string}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(
    ownProps,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )
  if (!conversationIDKey) {
    throw new Error('conversationIDKey unexpectedly empty')
  }

  const teamname = Container.getRouteProps(ownProps, 'teamname', '')
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
  // _loadChannelInfo if channelInfo is empty. Although even if
  // channelInfo is non-empty, it might not be updated; that hasn't
  // been a problem yet, though.

  const channelInfo = Constants.getChannelInfoFromConvID(state, teamname, conversationIDKey)

  const channelName = channelInfo ? channelInfo.channelname : ''
  const topic = channelInfo ? channelInfo.description : ''
  const yourRole = Constants.getRole(state, teamname)
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  const errorText = state.teams.channelCreationError
  const waitingOnSave = anyWaiting(state, Constants.teamWaitingKey(teamname))
  return {
    canDelete,
    channelName,
    conversationIDKey,
    errorText,
    teamname,
    topic,
    waitingForGetInfo: !channelInfo,
    waitingOnSave,
  }
}

const ConnectedEditChannel = Container.connect(
  mapStateToProps,
  dispatch => ({
    _loadChannelInfo: (teamname: string, conversationIDKey: Types.ConversationIDKey) =>
      dispatch(TeamsGen.createGetChannelInfo({conversationIDKey, teamname})),
    _navigateUp: () => dispatch(RouteTreeGen.createNavigateUp()),
    _onConfirmedDelete: (teamname: string, conversationIDKey: Types.ConversationIDKey) =>
      dispatch(TeamsGen.createDeleteChannelConfirmed({conversationIDKey, teamname})),
    _onSetChannelCreationError: error => dispatch(TeamsGen.createSetChannelCreationError({error})),
    _updateChannelName: (
      teamname: string,
      conversationIDKey: Types.ConversationIDKey,
      newChannelName: string
    ) => dispatch(TeamsGen.createUpdateChannelName({conversationIDKey, newChannelName, teamname})),
    _updateTopic: (teamname: string, conversationIDKey: Types.ConversationIDKey, newTopic: string) =>
      dispatch(TeamsGen.createUpdateTopic({conversationIDKey, newTopic, teamname})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {teamname, conversationIDKey, channelName, topic, waitingOnSave} = stateProps
    const deleteRenameDisabled = channelName === 'general'
    return {
      channelName,
      deleteRenameDisabled,
      errorText: upperFirst(stateProps.errorText),
      loadChannelInfo: () => dispatchProps._loadChannelInfo(teamname, conversationIDKey),
      onCancel: dispatchProps._navigateUp,
      onConfirmedDelete: () => {
        dispatchProps._onConfirmedDelete(teamname, conversationIDKey)
        dispatchProps._navigateUp()
      },
      onSave: (newChannelName: string, newTopic: string) => {
        if (!deleteRenameDisabled && newChannelName !== channelName) {
          dispatchProps._onSetChannelCreationError('')
          dispatchProps._updateChannelName(teamname, conversationIDKey, newChannelName)
        }

        if (newTopic !== topic) {
          dispatchProps._updateTopic(teamname, conversationIDKey, newTopic)
        }
      },
      onSaveSuccess: dispatchProps._navigateUp,
      onSetChannelCreationError: dispatchProps._onSetChannelCreationError,
      showDelete: stateProps.canDelete,
      teamname,
      title: `Edit #${channelName}`,
      topic,
      waitingForGetInfo: stateProps.waitingForGetInfo,
      waitingOnSave,
    }
  }
)(EditChannel)
export default ConnectedEditChannel
