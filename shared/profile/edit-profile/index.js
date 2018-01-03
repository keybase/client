// @flow
import Render from './render'
import {
  compose,
  withHandlers,
  withPropsOnChange,
  withState,
  connect,
  type TypedState,
} from '../../util/container'
import {createEditProfile} from '../../actions/profile-gen'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'
import {HeaderHoc} from '../../common-adapters'

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
  onEditProfile: ({bio, fullname, location}) => dispatch(createEditProfile({bio, fullname, location})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('bio', 'onBioChange', props => props.bio),
  withState('fullname', 'onFullnameChange', props => props.fullname),
  withState('location', 'onLocationChange', props => props.location),
  withPropsOnChange(['bio'], props => ({
    bioLengthLeft: props.bio ? maxProfileBioChars - props.bio.length : maxProfileBioChars,
  })),
  HeaderHoc,
  withHandlers({
    onCancel: ({onBack}) => () => onBack(),
    onSubmit: ({bio, fullname, location, onEditProfile}) => () => onEditProfile({bio, fullname, location}),
  })
)(Render)
