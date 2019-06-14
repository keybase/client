import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import Joined from '.'
import {connect, isMobile} from '../../../../util/container'
import {chatTab} from '../../../../constants/tabs'

type OwnProps = {
  message: Types.MessageSystemJoined
}

const mapStateToProps = (state, {message}) => ({
  _meta: Constants.getMeta(state, message.conversationIDKey),
  author: message.author,
  authorIsYou: state.config.username === message.author,
  timestamp: message.timestamp,
})

const mapDispatchToProps = dispatch => ({
  _onManageChannels: (teamname: string) =>
    isMobile
      ? dispatch(
          RouteTreeGen.createNavigateTo({
            parentPath: [chatTab],
            path: [{props: {teamname}, selected: 'chatManageChannels'}],
          })
        )
      : dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
        ),
  _onManageNotifications: conversationIDKey =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey: conversationIDKey, tab: 'settings'}, selected: 'chatInfoPanel'}],
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_meta} = stateProps
  return {
    author: stateProps.author,
    authorIsYou: stateProps.authorIsYou,
    channelname: _meta.channelname,
    isBigTeam: _meta.teamType === 'big',
    onManageChannels: () => dispatchProps._onManageChannels(_meta.teamname),
    onManageNotifications: () => dispatchProps._onManageNotifications(_meta.conversationIDKey),
    teamname: _meta.teamname,
    timestamp: stateProps.timestamp,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Joined)
