// @flow
import {connect, isMobile, type TypedState} from '../../../../util/container'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {createGetProfile} from '../../../../actions/tracker-gen'
import SetDescription from '.'

const mapStateToProps = (state: TypedState, {message}) => ({
  author: message.author,
  description: message.newDescription.stringValue(),
  setUsernameBlack: message.author === state.config.username,
  timestamp: message.timestamp,
})

const mapDispatchToProps = (dispatch, {message}) => ({
  onUsernameClicked: () =>
    isMobile
      ? dispatch(createShowUserProfile({username: message.author}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username: message.author})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(SetDescription)
