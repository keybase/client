import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/chat2'
import * as TeamsTypes from '../../constants/types/teams'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EditChannel from './edit-channel'
import * as Container from '../../util/container'
import upperFirst from 'lodash/upperFirst'
import {useChannelMeta} from '../../teams/common/channel-hooks'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey; teamID: TeamsTypes.TeamID}>

const EditChannelWrapper = (props: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(
    props,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )
  if (!conversationIDKey) {
    throw new Error('conversationIDKey unexpectedly empty')
  }

  const teamID = Container.getRouteProps(props, 'teamID', TeamsTypes.noTeamID)
  if (!teamID) {
    throw new Error('teamID unexpectedly empty')
  }
  const teamname = Container.useSelector(state => Constants.getTeamNameFromID(state, teamID) || '')

  const conversationMeta = useChannelMeta(teamID, conversationIDKey)

  const channelName = conversationMeta ? conversationMeta.channelname : ''
  const topic = conversationMeta ? conversationMeta.description : ''

  const yourRole = Container.useSelector(state => Constants.getRole(state, teamID))
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  const errorText = Container.useSelector(state => state.teams.errorInChannelCreation)
  const waitingOnSave = Container.useAnyWaiting(Constants.updateChannelNameWaitingKey(teamID))

  const dispatch = Container.useDispatch()

  const dispatchProps = {
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
  }
  const deleteRenameDisabled = channelName === 'general'
  const childProps: React.ComponentProps<typeof EditChannel> = {
    channelName,
    deleteRenameDisabled,
    errorText: upperFirst(errorText),
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
    showDelete: canDelete,
    teamname,
    title: `Edit #${channelName}`,
    topic,
    waitingForGetInfo: conversationMeta === null,
    waitingOnSave,
  }
  return <EditChannel {...childProps} />
}
export default EditChannelWrapper
