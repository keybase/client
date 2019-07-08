import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ConfirmOrPending from '.'
import {ProofStatus} from '../../constants/types/rpc-gen'
import {globalColors} from '../../styles'
import * as Container from '../../util/container'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => {
  const profile = state.profile
  const isGood = profile.proofFound && profile.proofStatus === ProofStatus.ok
  const isPending =
    !isGood &&
    !profile.proofFound &&
    !!profile.proofStatus &&
    profile.proofStatus <= ProofStatus.baseHardError

  if (!profile.platform) {
    throw new Error('No platform passed to confirm or pending container')
  }

  return {
    isPending,
    platform: profile.platform,
    platformIconOverlayColor: isGood ? globalColors.green : globalColors.greyDark,
    username: profile.username,
  }
}

export default Container.connect(
  mapStateToProps,
  dispatch => ({
    onCancel: () => {
      dispatch(ProfileGen.createBackToProfile())
      dispatch(RouteTreeGen.createClearModals())
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(ConfirmOrPending)
