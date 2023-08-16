import * as C from '../../constants'
import * as Container from '../../util/container'
import Revoke from '.'
import type * as T from '../../constants/types'

type OwnProps = {
  icon: T.Tracker.SiteIconSet
  platform: T.More.PlatformsExpandedType
  platformHandle: string
  proofId: string
}
const noIcon: T.Tracker.SiteIconSet = []

export default (ownProps: OwnProps) => {
  const {platformHandle, platform, proofId} = ownProps
  const icon = ownProps.icon ?? noIcon
  const errorMessage = C.useProfileState(s => s.revokeError)
  const finishRevoking = C.useProfileState(s => s.dispatch.finishRevoking)
  const submitRevokeProof = C.useProfileState(s => s.dispatch.submitRevokeProof)
  const isWaiting = Container.useAnyWaiting(C.profileWaitingKey)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
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
