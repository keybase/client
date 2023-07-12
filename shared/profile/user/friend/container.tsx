import * as ProfileConstants from '../../../constants/profile'
import * as UsersConstants from '../../../constants/users'
import Friend from '.'

type OwnProps = {
  username: string
  width: number
}

export default (ownProps: OwnProps) => {
  const fullname = UsersConstants.useState(s => s.infoMap.get(ownProps.username)?.fullname ?? '')
  const username = ownProps.username
  const showUserProfile = ProfileConstants.useState(s => s.dispatch.showUserProfile)
  const _onClick = showUserProfile
  const props = {
    fullname: fullname || '',
    onClick: () => _onClick(username),
    username: username,
    width: ownProps.width,
  }
  return <Friend {...props} />
}
