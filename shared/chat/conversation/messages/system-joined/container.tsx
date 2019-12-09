import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import Joined from '.'
import * as Container from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemJoined
}

export default Container.connect(
  (state, {message}: OwnProps) => ({
    _meta: Constants.getMeta(state, message.conversationIDKey),
    author: message.author,
    authorIsYou: state.config.username === message.author,
    joiners: !message.joiners.length && !message.leavers.length ? [message.author] : message.joiners,
    leavers: message.leavers,
    timestamp: message.timestamp,
  }),
  dispatch => ({
    _onAuthorClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    _onManageChannels: (teamname: string) =>
      Container.isMobile
        ? dispatch(
            RouteTreeGen.createNavigateAppend({
              path: [{props: {teamname}, selected: 'chatManageChannels'}],
            })
          )
        : dispatch(
            RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
          ),
    _onManageNotifications: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey: conversationIDKey, tab: 'settings'}, selected: 'chatInfoPanel'}],
        })
      ),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {_meta} = stateProps
    return {
      author: stateProps.author,
      authorIsYou: stateProps.authorIsYou,
      channelname: _meta.channelname,
      isBigTeam: _meta.teamType === 'big',
      joiners: stateProps.joiners,
      leavers: stateProps.leavers,
      onAuthorClick: () => dispatchProps._onAuthorClick(stateProps.author),
      onManageChannels: () => dispatchProps._onManageChannels(_meta.teamname),
      onManageNotifications: () => dispatchProps._onManageNotifications(_meta.conversationIDKey),
      teamname: _meta.teamname,
      timestamp: stateProps.timestamp,
    }
  }
)(Joined)
