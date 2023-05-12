import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps2<'profileRevoke'>
const noIcon = []

export default (ownProps: OwnProps) => {
  const {platformHandle, platform, proofId} = ownProps.route.params
  const icon = ownProps.route.params.icon ?? noIcon
  const errorMessage = Container.useSelector(state => state.profile.revokeError)
  const isWaiting = Container.useSelector(state => Waiting.anyWaiting(state, Constants.waitingKey))
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(ProfileGen.createFinishRevoking())
    dispatch(RouteTreeGen.createClearModals())
  }
  const onRevoke = () => {
    proofId && dispatch(ProfileGen.createSubmitRevokeProof({proofId}))
    dispatch(RouteTreeGen.createClearModals())
  }
  const props = {
    errorMessage,
    icon,
    isWaiting,
    onCancel,
    onRevoke,
    platform,
    platformHandle,
  }
  return <Revoke {...props} />
}
