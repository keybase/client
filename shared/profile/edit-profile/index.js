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
import {editProfile} from '../../actions/profile'
import {maxProfileBioChars} from '../../constants/profile'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  if (!state.config.username) {
    throw new Error("Didn't get username")
  }
  const trackerInfo = state.tracker.trackers[state.config.username]
  if (!trackerInfo || trackerInfo.type !== 'tracker') {
    throw new Error("Didn't get trackerinfo")
  }
  const userInfo = trackerInfo.userInfo
  const {bio, fullname, location} = userInfo
  return {bio, fullname, location}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  onEditProfile: ({bio, fullname, location}) => dispatch(editProfile(bio, fullname, location)),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('bio', 'onBioChange', props => props.bio),
  withState('fullname', 'onFullnameChange', props => props.fullname),
  withState('location', 'onLocationChange', props => props.location),
  withPropsOnChange(['bio'], props => ({
    bioLengthLeft: props.bio ? maxProfileBioChars - props.bio.length : maxProfileBioChars,
  })),
  withHandlers({
    onCancel: ({onBack}) => () => onBack(),
    onSubmit: ({bio, fullname, location, onEditProfile}) => () => onEditProfile({bio, fullname, location}),
  })
)(Render)
