import * as C from '@/constants'
import Revoke from '.'
import type * as T from '@/constants/types'

type OwnProps = {
  icon: T.Tracker.SiteIconSet
  platform: T.More.PlatformsExpandedType
  platformHandle: string
  proofId: string
}
const Container = (ownProps: OwnProps) => {
  const {platformHandle, platform, proofId, icon} = ownProps
  const errorMessage = C.useProfileState(s => s.revokeError)
  const finishRevoking = C.useProfileState(s => s.dispatch.finishRevoking)
  const submitRevokeProof = C.useProfileState(s => s.dispatch.submitRevokeProof)
  const isWaiting = C.Waiting.useAnyWaiting(C.Profile.waitingKey)
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

export default Container
