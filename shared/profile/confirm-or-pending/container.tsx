import * as C from '../../constants'
import ConfirmOrPending from '.'
import * as T from '../../constants/types'
import {globalColors} from '../../styles'

export default () => {
  const proofFound = C.useProfileState(s => s.proofFound)
  const proofStatus = C.useProfileState(s => s.proofStatus)
  const platform = C.useProfileState(s => s.platform)
  const username = C.useProfileState(s => s.username)
  const backToProfile = C.useProfileState(s => s.dispatch.backToProfile)

  const isGood = proofFound && proofStatus === T.RPCGen.ProofStatus.ok
  const isPending =
    !isGood && !proofFound && !!proofStatus && proofStatus <= T.RPCGen.ProofStatus.baseHardError

  if (!platform) {
    throw new Error('No platform passed to confirm or pending container')
  }

  const platformIconOverlayColor = isGood ? globalColors.green : globalColors.greyDark
  const onCancel = backToProfile
  const props = {isPending, onCancel, platform, platformIconOverlayColor, username}
  return <ConfirmOrPending {...props} />
}
