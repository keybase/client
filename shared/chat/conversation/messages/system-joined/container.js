// @flow
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTree from '../../../../actions/route-tree'
import Joined from '.'
import {connect, isMobile} from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {createGetProfile} from '../../../../actions/tracker-gen'
import {chatTab} from '../../../../constants/tabs'

type OwnProps = {|
  message: Types.MessageSystemJoined,
|}

const mapStateToProps = (state, {message}) => ({
  _meta: Constants.getMeta(state, message.conversationIDKey),
  you: state.config.username || '',
})

const mapDispatchToProps = dispatch => ({
  _onManageChannels: (teamname: string) =>
    isMobile
      ? dispatch(RouteTree.navigateTo([{props: {teamname}, selected: 'manageChannels'}], [chatTab]))
      : dispatch(RouteTree.navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  onUsernameClicked: (username: string) =>
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_meta} = stateProps
  return {
    channelname: _meta.channelname,
    isBigTeam: _meta.teamType === 'big',
    message: ownProps.message,
    onManageChannels: () => dispatchProps._onManageChannels(_meta.teamname),
    onUsernameClicked: dispatchProps.onUsernameClicked,
    teamname: _meta.teamname,
    you: stateProps.you,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Joined)
