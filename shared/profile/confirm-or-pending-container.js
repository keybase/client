// @flow
import ConfirmOrPending from './confirm-or-pending'
import {ProveCommonProofStatus} from '../constants/types/flow-types'
import {cancelAddProof, backToProfile} from '../actions/profile'
import {globalColors} from '../styles'
import {connect} from 'react-redux'
import {type TypedState} from '../constants/reducer'

const mapStateToProps = (state: TypedState) => {
  const profile = state.profile
  const isGood = profile.proofFound && profile.proofStatus === ProveCommonProofStatus.ok
  const isPending =
    !isGood &&
    !profile.proofFound &&
    !!profile.proofStatus &&
    profile.proofStatus <= ProveCommonProofStatus.baseHardError

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
  onCancel: () => dispatch(cancelAddProof()),
  onReloadProfile: () => dispatch(backToProfile()),
})

export default connect(mapStateToProps, mapDispatchToProps)(ConfirmOrPending)
