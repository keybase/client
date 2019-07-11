import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as Constants from '../../constants/tracker2'
import * as Container from '../../util/container'
import EditProfile from '.'

type OwnProps = Container.RouteProps<
  {
    username: string
  },
  {}
>

const mapStateToProps = state => {
  const d = Constants.getDetails(state, state.config.username)
  return {
    bio: d.bio || '',
    fullname: d.fullname || '',
    location: d.location || '',
  }
}
const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSubmit: (bio: string, fullname: string, location: string) => {
    dispatch(ProfileGen.createEditProfile({bio, fullname, location}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
})
const mergeProps = (stateProps, dispatchProps) => ({
  bio: stateProps.bio,
  fullname: stateProps.fullname,
  location: stateProps.location,
  onCancel: dispatchProps.onCancel,
  onSubmit: dispatchProps.onSubmit,
  title: 'Edit Profile',
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'EditProfile')(
  EditProfile
)
