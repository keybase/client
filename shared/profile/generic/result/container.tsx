import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import Success from '.'

export default () => {
  const errorText = Container.useSelector(state =>
    state.profile.errorCode !== null ? state.profile.errorText || 'Failed to verify proof' : ''
  )
  const proofUsername = Container.useSelector(
    state => state.profile.username + state.profile.platformGenericParams?.suffix ?? '@unknown'
  )
  const serviceIcon = Container.useSelector(state => state.profile.platformGenericParams?.logoFull ?? [])
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ProfileGen.createBackToProfile())
    dispatch(ProfileGen.createClearPlatformGeneric())
  }
  const props = {
    errorText,
    onClose,
    proofUsername,
    serviceIcon,
  }
  return <Success {...props} />
}
