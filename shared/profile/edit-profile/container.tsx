import * as C from '../../constants'
import * as Constants from '../../constants/tracker2'
import EditProfile from '.'

export default () => {
  const username = C.useCurrentUserState(s => s.username)
  const d = C.useTrackerState(s => Constants.getDetails(s, username))
  const bio = d.bio || ''
  const fullname = d.fullname || ''
  const location = d.location || ''

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }

  const editProfile = C.useProfileState(s => s.dispatch.editProfile)
  const onSubmit = (bio: string, fullname: string, location: string) => {
    editProfile(bio, fullname, location)
    navigateUp()
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
