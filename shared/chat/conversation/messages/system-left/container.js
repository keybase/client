// @flow
import * as Constants from '../../../../constants/chat2'
import Joined from '.'
import {connect, isMobile} from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {createGetProfile} from '../../../../actions/tracker-gen'

const mapStateToProps = (state, {message}) => ({
  _meta: Constants.getMeta(state, message.conversationIDKey),
  you: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  onUsernameClicked: (username: string) => {
    if (isMobile) {
      dispatch(createShowUserProfile({username}))
    } else {
      dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username}))
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const {_meta} = stateProps
  return {
    channelname: _meta.channelname,
    isBigTeam: _meta.teamType === 'big',
    message: ownProps.message,
    onUsernameClicked: dispatchProps.onUsernameClicked,
    teamname: _meta.teamname,
    you: stateProps.you,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Joined)
