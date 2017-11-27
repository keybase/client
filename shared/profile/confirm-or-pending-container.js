// @flow
import * as ProfileGen from '../actions/profile-gen'
import ConfirmOrPending from './confirm-or-pending'
import {proveCommonProofStatus} from '../constants/types/flow-types'
import {globalColors} from '../styles'
import {connect} from 'react-redux'
import {type TypedState} from '../constants/reducer'

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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => dispatch(ProfileGen.createCancelAddProof()),
  onReloadProfile: () => dispatch(ProfileGen.createBackToProfile()),
})

export default connect(mapStateToProps, mapDispatchToProps)(ConfirmOrPending)
