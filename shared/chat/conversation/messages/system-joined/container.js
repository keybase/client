// @flow
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import Joined from '.'
import {connect, isMobile} from '../../../../util/container'
import {chatTab} from '../../../../constants/tabs'

type OwnProps = {|
  message: Types.MessageSystemJoined,
|}

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
            path: [{props: {teamname}, selected: 'manageChannels'}],
          })
        )
      : dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'manageChannels'}]})
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
    teamname: _meta.teamname,
    timestamp: stateProps.timestamp,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Joined)
