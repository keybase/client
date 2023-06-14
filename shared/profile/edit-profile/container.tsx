import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as Constants from '../../constants/tracker2'
import * as ConfigConstants from '../../constants/config'
import * as Container from '../../util/container'
import EditProfile from '.'

export default () => {
  const username = ConfigConstants.useConfigState(s => s.username)
  const d = Container.useSelector(state => Constants.getDetails(state, username))
  const bio = d.bio || ''
  const fullname = d.fullname || ''
  const location = d.location || ''

  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSubmit = (bio: string, fullname: string, location: string) => {
    dispatch(ProfileGen.createEditProfile({bio, fullname, location}))
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    bio,
    fullname,
    location,
    onCancel,
    onSubmit,
    title: 'Edit Profile',
  }
  return <EditProfile {...props} />
}
