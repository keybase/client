// @flow
import * as Constants from '../../constants/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/chat2'
import EditChannel, {type Props} from './edit-channel'
import {connect, compose, lifecycle, type RouteProps} from '../../util/container'

type OwnProps = RouteProps<
  {
    conversationIDKey: Types.ConversationIDKey,
    teamname: string,
  },
  {waitingForSave: number}
>

const mapStateToProps = (state, {navigateUp, routePath, routeProps}) => {
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
  // _loadChannelInfo if channelInfo is empty. Although even if
  // channelInfo is non-empty, it might not be updated; that hasn't
  // been a problem yet, though.

  const channelInfo = Constants.getChannelInfoFromConvID(state, teamname, conversationIDKey)

  const channelName = channelInfo ? channelInfo.channelname : ''
  const topic = channelInfo ? channelInfo.description : ''
  const yourRole = Constants.getRole(state, teamname)
  const canDelete = Constants.isAdmin(yourRole) || Constants.isOwner(yourRole)
  return {
    canDelete,
    channelName,
    conversationIDKey,
    teamname,
    topic,
    waitingForGetInfo: !channelInfo,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routePath, routeProps}) => {
  return {
    _loadChannelInfo: (teamname: string, conversationIDKey: Types.ConversationIDKey) =>
      dispatch(TeamsGen.createGetChannelInfo({conversationIDKey, teamname})),
    _navigateUp: () => dispatch(navigateUp()),
    _onConfirmedDelete: (teamname: string, conversationIDKey: Types.ConversationIDKey) =>
      dispatch(TeamsGen.createDeleteChannelConfirmed({conversationIDKey, teamname})),
    _updateChannelName: (
      teamname: string,
      conversationIDKey: Types.ConversationIDKey,
      newChannelName: string
    ) => dispatch(TeamsGen.createUpdateChannelName({conversationIDKey, newChannelName, teamname})),
    _updateTopic: (teamname: string, conversationIDKey: Types.ConversationIDKey, newTopic: string) =>
      dispatch(TeamsGen.createUpdateTopic({conversationIDKey, newTopic, teamname})),
  }
}

const mergeProps = (stateProps, dispatchProps, {routeState}): Props => {
  const {teamname, conversationIDKey, channelName, topic} = stateProps
  const deleteRenameDisabled = channelName === 'general'
  return {
    _loadChannelInfo: () => dispatchProps._loadChannelInfo(teamname, conversationIDKey),
    channelName,
    deleteRenameDisabled,
    onCancel: dispatchProps._navigateUp,
    onConfirmedDelete: () => {
      dispatchProps._onConfirmedDelete(teamname, conversationIDKey)
      dispatchProps._navigateUp()
    },
    onSave: (newChannelName: string, newTopic: string) => {
      if (!deleteRenameDisabled && newChannelName !== channelName) {
        dispatchProps._updateChannelName(teamname, conversationIDKey, newChannelName)
      }

      if (newTopic !== topic) {
        dispatchProps._updateTopic(teamname, conversationIDKey, newTopic)
      }

      dispatchProps._navigateUp()
    },
    showDelete: stateProps.canDelete,
    teamname,
    topic,
    waitingForGetInfo: stateProps.waitingForGetInfo,
  }
}

const ConnectedEditChannel = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      if (this.props.waitingForGetInfo) {
        this.props._loadChannelInfo()
      }
    },
  })
)(EditChannel)
export default ConnectedEditChannel
