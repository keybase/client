import * as Constants from '../../constants/profile'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Revoke from '.'
import type {PlatformsExpandedType} from '../../constants/types/more'
import type {SiteIconSet} from '../../constants/types/tracker2'

type OwnProps = {
  icon: SiteIconSet
  platform: PlatformsExpandedType
  platformHandle: string
  proofId: string
}
const noIcon = []

export default (ownProps: OwnProps) => {
  const {platformHandle, platform, proofId} = ownProps
  const icon = ownProps.icon ?? noIcon
  const errorMessage = Constants.useState(s => s.revokeError)
  const finishRevoking = Constants.useState(s => s.dispatch.finishRevoking)
  const submitRevokeProof = Constants.useState(s => s.dispatch.submitRevokeProof)
  const isWaiting = Container.useAnyWaiting(Constants.waitingKey)
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    finishRevoking()
    dispatch(RouteTreeGen.createClearModals())
  }
  const onRevoke = () => {
    proofId && submitRevokeProof(proofId)
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
