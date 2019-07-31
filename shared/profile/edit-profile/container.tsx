import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import EditProfile from '.'

type OwnProps = {}

export default Container.namedConnect(
  state => {
    const d = Constants.getDetails(state, state.config.username)
    return {
      bio: d.bio || '',
      fullname: d.fullname || '',
      location: d.location || '',
    }
  },
  dispatch => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (bio: string, fullname: string, location: string) => {
      dispatch(ProfileGen.createEditProfile({bio, fullname, location}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    bio: stateProps.bio,
    fullname: stateProps.fullname,
    location: stateProps.location,
    onCancel: dispatchProps.onCancel,
    onSubmit: dispatchProps.onSubmit,
    title: 'Edit Profile',
  }),
  'EditProfile'
)(EditProfile)
