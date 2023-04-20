import * as ProfileGen from '../../actions/profile-gen'
import ConfirmOrPending from '.'
import {ProofStatus} from '../../constants/types/rpc-gen'
import {globalColors} from '../../styles'
import * as Container from '../../util/container'

export default () => {
  const profile = Container.useSelector(state => state.profile)
  const isGood = profile.proofFound && profile.proofStatus === ProofStatus.ok
  const isPending =
    !isGood &&
    !profile.proofFound &&
    !!profile.proofStatus &&
    profile.proofStatus <= ProofStatus.baseHardError

  if (!profile.platform) {
    throw new Error('No platform passed to confirm or pending container')
  }

  const platform = profile.platform
  const platformIconOverlayColor = isGood ? globalColors.green : globalColors.greyDark
  const username = profile.username

  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(ProfileGen.createBackToProfile())
  }
  const props = {isPending, onCancel, platform, platformIconOverlayColor, username}
  return <ConfirmOrPending {...props} />
}
