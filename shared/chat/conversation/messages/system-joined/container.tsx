import * as Types from '../../../../constants/types/chat2'
import * as TeamsTypes from '../../../../constants/types/teams'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import Joined from '.'
import * as Container from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemJoined
}

export default Container.connect(
  (state, {message}: OwnProps) => ({
    _joiners: message.joiners,
    _meta: Constants.getMeta(state, message.conversationIDKey),
    author: message.author,
    authorIsYou: state.config.username === message.author,
    leavers: message.leavers,
    timestamp: message.timestamp,
  }),
  dispatch => ({
    _onManageChannels: (teamID: TeamsTypes.TeamID) => dispatch(TeamsGen.createManageChatChannels({teamID})),
    _onManageNotifications: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(
        Chat2Gen.createShowInfoPanel({
          conversationIDKey,
          show: true,
          tab: 'settings',
        })
      ),
    onAuthorClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {_meta} = stateProps
    return {
      author: stateProps.author,
      authorIsYou: stateProps.authorIsYou,
      channelname: _meta.channelname,
      isAdHoc: _meta.teamType === 'adhoc',
      isBigTeam: _meta.teamType === 'big',
      joiners:
        !stateProps._joiners.length && !stateProps.leavers.length ? [stateProps.author] : stateProps._joiners,
      leavers: stateProps.leavers,
      onAuthorClick: dispatchProps.onAuthorClick,
      onManageChannels: () => dispatchProps._onManageChannels(_meta.teamID),
      onManageNotifications: () => dispatchProps._onManageNotifications(_meta.conversationIDKey),
      teamname: _meta.teamname,
      timestamp: stateProps.timestamp,
    }
  }
)(Joined)
