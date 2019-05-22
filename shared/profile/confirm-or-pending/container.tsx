import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ConfirmOrPending from '.'
import {proveCommonProofStatus} from '../../constants/types/rpc-gen'
import {globalColors} from '../../styles'
import {connect} from '../../util/container'

type OwnProps = {}

const mapStateToProps = state => {
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
    platformIconOverlayColor: isGood ? globalColors.green : globalColors.greyDark,
    username: profile.username,
  }
}

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(ProfileGen.createBackToProfile())
    dispatch(RouteTreeGen.createClearModals())
  },
})

// @ts-ignore codemode issue
export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ConfirmOrPending)
