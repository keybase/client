import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import SystemText from '.'

type OwnProps = {
  message: Types.MessageSystemText
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onClickUserAvatar: (username: string) =>
    Container.isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(Tracker2Gen.createShowUser({asTracker: true, username})),
})

export default Container.connect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(SystemText)
