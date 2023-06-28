import ConfirmOrPending from '.'
import {ProofStatus} from '../../constants/types/rpc-gen'
import {globalColors} from '../../styles'
import * as Constants from '../../constants/profile'

export default () => {
  const proofFound = Constants.useState(s => s.proofFound)
  const proofStatus = Constants.useState(s => s.proofStatus)
  const platform = Constants.useState(s => s.platform)
  const username = Constants.useState(s => s.username)
  const backToProfile = Constants.useState(s => s.dispatch.backToProfile)

  const isGood = proofFound && proofStatus === ProofStatus.ok
  const isPending = !isGood && !proofFound && !!proofStatus && proofStatus <= ProofStatus.baseHardError

  if (!platform) {
    throw new Error('No platform passed to confirm or pending container')
  }

  const platformIconOverlayColor = isGood ? globalColors.green : globalColors.greyDark
  const onCancel = backToProfile
  const props = {isPending, onCancel, platform, platformIconOverlayColor, username}
  return <ConfirmOrPending {...props} />
}
