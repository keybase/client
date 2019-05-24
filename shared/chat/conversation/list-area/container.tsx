import * as Types from '../../../constants/types/chat2'
import * as ProfileGen from '../../../actions/profile-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import Normal from './normal/container'
import {connect, isMobile} from '../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
  onFocusInput: () => void
}

const mapStateToProps = (state, {conversationIDKey}) => ({conversationIDKey})

const mapDispatchToProps = dispatch => ({
  onShowTracker: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  conversationIDKey: stateProps.conversationIDKey,
  onFocusInput: ownProps.onFocusInput,
  scrollListDownCounter: ownProps.scrollListDownCounter,
  scrollListToBottomCounter: ownProps.scrollListToBottomCounter,
  scrollListUpCounter: ownProps.scrollListUpCounter,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Normal)
