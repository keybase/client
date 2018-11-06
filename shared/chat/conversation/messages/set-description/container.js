// @flow
import {connect, isMobile} from '../../../../util/container'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as TrackerGen from '../../../../actions/tracker-gen'
import * as Types from '../../../../constants/types/chat2'
import SetDescription from '.'

type OwnProps = {|
  message: Types.Message,
|}

const mapStateToProps = (state, {message}) => ({
  author: message.author,
  description: message.newDescription.stringValue(),
  setUsernameBlack: message.author === state.config.username,
  timestamp: message.timestamp,
})

const mapDispatchToProps = (dispatch, {message}) => ({
  onUsernameClicked: () =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username: message.author}))
      : dispatch(
          TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username: message.author})
        ),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(SetDescription)
