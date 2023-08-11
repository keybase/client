import * as C from '../../constants'
import * as Constants from '../../constants/tracker2'
import * as ProfileConstants from '../../constants/profile'
import * as ConfigConstants from '../../constants/config'
import EditProfile from '.'

export default () => {
  const username = ConfigConstants.useCurrentUserState(s => s.username)
  const d = Constants.useState(s => Constants.getDetails(s, username))
  const bio = d.bio || ''
  const fullname = d.fullname || ''
  const location = d.location || ''

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }

  const editProfile = ProfileConstants.useState(s => s.dispatch.editProfile)
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
