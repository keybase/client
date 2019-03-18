// @flow
import * as ProfileGen from '../../actions/profile-gen'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import EditProfile from '.'

type OwnProps = Container.RouteProps<{|username: string|}, {}>

const mapStateToProps = (state, ownProps) => {
  const d = Constants.getDetails(state, state.config.username)
  return {
    bio: d.bio || '',
    fullname: d.fullname || '',
    location: d.location || '',
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({
  onCancel: () => dispatch(ownProps.navigateUp()),
  onSubmit: (bio: string, fullname: string, location: string) => {
    dispatch(ProfileGen.createEditProfile({bio, fullname, location}))
    dispatch(ownProps.navigateUp())
  },
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  bio: stateProps.bio,
  fullname: stateProps.fullname,
  location: stateProps.location,
  onCancel: dispatchProps.onCancel,
  onSubmit: dispatchProps.onSubmit,
  title: 'Edit Profile',
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'EditProfile'
)(EditProfile)
