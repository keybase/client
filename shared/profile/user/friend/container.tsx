import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import Friend from '.'

type OwnProps = {
  username: string
  width: number
}

export default (ownProps: OwnProps) => {
  const fullname = Container.useSelector(state => state.users.infoMap.get(ownProps.username)?.fullname ?? '')
  const username = ownProps.username
  const dispatch = Container.useDispatch()
  const _onClick = (username: string) => {
    dispatch(ProfileGen.createShowUserProfile({username}))
  }
  const props = {
    fullname: fullname || '',
    onClick: () => _onClick(username),
    username: username,
    width: ownProps.width,
  }
  return <Friend {...props} />
}
