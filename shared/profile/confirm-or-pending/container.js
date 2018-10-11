// @flow
import * as ProfileGen from '../../actions/profile-gen'
import ConfirmOrPending from '.'
import {proveCommonProofStatus} from '../../constants/types/rpc-gen'
import {globalColors} from '../../styles'
import {connect} from '../../util/container'
import {type TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => {
  const profile = state.profile
  const isGood = profile.proofFound && profile.proofStatus === proveCommonProofStatus.ok
  const isPending =
    !isGood &&
    !profile.proofFound &&
    !!profile.proofStatus &&
    profile.proofStatus <= proveCommonProofStatus.baseHardError

  if (!profile.platform) {
    throw new Error('No platform passed to confirm or pending container')
  }

  return {
    isPending,
    platform: profile.platform,
    platformIconOverlayColor: isGood ? globalColors.green : globalColors.grey,
    titleColor: isGood ? globalColors.green : globalColors.blue,
    username: profile.username,
  }
}

const mapDispatchToProps = (dispatch) => ({
  onReloadProfile: () => dispatch(ProfileGen.createBackToProfile()),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ConfirmOrPending)
