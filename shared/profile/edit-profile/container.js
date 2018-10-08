// @flow
import Render from '.'
import {
  compose,
  withHandlers,
  withPropsOnChange,
  withStateHandlers,
  connect,
  type TypedState,
} from '../../util/container'
import {createEditProfile} from '../../actions/profile-gen'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'
import {HeaderOnMobile} from '../../common-adapters'
import {isMobile} from '../../constants/platform'

const mapStateToProps = (state: TypedState) => {
  if (!state.config.username) {
    throw new Error("Didn't get username")
  }
  const trackerInfo = state.tracker.userTrackers[state.config.username]
  if (!trackerInfo) {
    throw new Error("Didn't get trackerinfo")
  }
  const userInfo = trackerInfo.userInfo
  const {bio, fullname, location} = userInfo
  return {bio, fullname, location, title: 'Edit Profile'}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  onEditProfile: (bio: string, fullname: string, location: string) =>
    dispatch(createEditProfile({bio, fullname, location})),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(props => ({bio: props.bio, fullname: props.fullname, location: props.location}), {
    onBioChange: () => bio => ({bio}),
    onFullnameChange: () => fullname => ({fullname}),
    onLocationChange: () => location => ({location}),
  }),
  withPropsOnChange(['bio'], props => ({
    bioLengthLeft: props.bio ? maxProfileBioChars - props.bio.length : maxProfileBioChars,
  })),
  withHandlers({
    ...(isMobile ? {} : {onCancel: ({onBack}) => () => onBack()}),
    onSubmit: ({bio, fullname, location, onEditProfile}) => () => onEditProfile(bio, fullname, location),
  })
)(HeaderOnMobile(Render))
