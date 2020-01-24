import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/chat2'
import * as TeamsTypes from '../../constants/types/teams'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EditChannel from './edit-channel'
import * as Container from '../../util/container'
import upperFirst from 'lodash/upperFirst'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey; teamID: TeamsTypes.TeamID}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(
    ownProps,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )
  if (!conversationIDKey) {
    throw new Error('conversationIDKey unexpectedly empty')
  }

  const teamID = Container.getRouteProps(ownProps, 'teamID', '')
  if (!teamID) {
    throw new Error('teamID unexpectedly empty')
  }
  const teamname = Constants.getTeamNameFromID(state, teamID) || ''

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

  const channelInfo = Constants.getChannelInfoFromConvID(state, teamID, conversationIDKey)

  const channelName = channelInfo ? channelInfo.channelname : ''
  const topic = channelInfo ? channelInfo.description : ''

  const yourRole = Constants.getRole(state, teamID)
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  const errorText = state.teams.errorInChannelCreation
  const waitingOnSave = anyWaiting(state, Constants.teamWaitingKey(teamname))
  return {
    canDelete,
    channelName,
    conversationIDKey,
    errorText,
    teamID,
    teamname,
    topic,
    waitingForGetInfo: !channelInfo,
    waitingOnSave,
  }
}

const ConnectedEditChannel = Container.connect(
  mapStateToProps,
  dispatch => ({
    _loadChannelInfo: (teamID: TeamsTypes.TeamID, conversationIDKey: Types.ConversationIDKey) =>
      dispatch(TeamsGen.createGetChannelInfo({conversationIDKey, teamID})),
    _navigateUp: () => dispatch(RouteTreeGen.createNavigateUp()),
    _onConfirmedDelete: (teamID: TeamsTypes.TeamID, conversationIDKey: Types.ConversationIDKey) =>
      dispatch(TeamsGen.createDeleteChannelConfirmed({conversationIDKey, teamID})),
    _onSetChannelCreationError: (error: string) => dispatch(TeamsGen.createSetChannelCreationError({error})),
    _updateChannelName: (
      teamID: TeamsTypes.TeamID,
      conversationIDKey: Types.ConversationIDKey,
      newChannelName: string
    ) => dispatch(TeamsGen.createUpdateChannelName({conversationIDKey, newChannelName, teamID})),
    _updateTopic: (teamID: TeamsTypes.TeamID, conversationIDKey: Types.ConversationIDKey, newTopic: string) =>
      dispatch(TeamsGen.createUpdateTopic({conversationIDKey, newTopic, teamID})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {teamID, teamname, conversationIDKey, channelName, topic, waitingOnSave} = stateProps
    const deleteRenameDisabled = channelName === 'general'
    return {
      channelName,
      deleteRenameDisabled,
      errorText: upperFirst(stateProps.errorText),
      loadChannelInfo: () => dispatchProps._loadChannelInfo(teamID, conversationIDKey),
      onCancel: dispatchProps._navigateUp,
      onConfirmedDelete: () => dispatchProps._onConfirmedDelete(teamID, conversationIDKey),
      onSave: (newChannelName: string, newTopic: string) => {
        if (!deleteRenameDisabled && newChannelName !== channelName) {
          dispatchProps._onSetChannelCreationError('')
          dispatchProps._updateChannelName(teamID, conversationIDKey, newChannelName)
        }

        if (newTopic !== topic) {
          dispatchProps._updateTopic(teamID, conversationIDKey, newTopic)
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
