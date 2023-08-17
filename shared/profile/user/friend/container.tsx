import * as C from '../../../constants'
import Friend from '.'

type OwnProps = {
  username: string
  width: number
}

export default (ownProps: OwnProps) => {
  const fullname = C.useUsersState(s => s.infoMap.get(ownProps.username)?.fullname ?? '')
  const username = ownProps.username
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const _onClick = showUserProfile
  const props = {
    fullname: fullname || '',
    onClick: () => _onClick(username),
    username: username,
    width: ownProps.width,
  }
  return <Friend {...props} />
}
