import * as Constants from '../../constants/profile'
import * as Container from '../../util/container'
import * as RouterConstants from '../../constants/router2'
import Revoke from '.'
import type {PlatformsExpandedType} from '../../constants/types/more'
import type {SiteIconSet} from '../../constants/types/tracker2'

type OwnProps = {
  icon: SiteIconSet
  platform: PlatformsExpandedType
  platformHandle: string
  proofId: string
}
const noIcon: SiteIconSet = []

export default (ownProps: OwnProps) => {
  const {platformHandle, platform, proofId} = ownProps
  const icon = ownProps.icon ?? noIcon
  const errorMessage = Constants.useState(s => s.revokeError)
  const finishRevoking = Constants.useState(s => s.dispatch.finishRevoking)
  const submitRevokeProof = Constants.useState(s => s.dispatch.submitRevokeProof)
  const isWaiting = Container.useAnyWaiting(Constants.waitingKey)
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onCancel = () => {
    finishRevoking()
    clearModals()
  }
  const onRevoke = () => {
    proofId && submitRevokeProof(proofId)
    clearModals()
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
