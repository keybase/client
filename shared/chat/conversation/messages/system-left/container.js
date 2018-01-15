// @flow
import * as Constants from '../../../../constants/chat2'
import Joined from '.'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {createGetProfile} from '../../../../actions/tracker-gen'

const mapStateToProps = (state: TypedState, {message}) => ({
  _meta: Constants.getMeta(state, message.conversationIDKey),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onUsernameClicked: (username: string) => {
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username}))
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
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Joined)
