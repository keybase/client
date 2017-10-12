// @flow
import PostProof from './post-proof'
import {cancelAddProof, checkProof, outputInstructionsActionLink} from '../actions/profile'
import {connect, type TypedState} from '../util/container'
import {type ProvablePlatformsType} from '../constants/types/more'

const mapStateToProps = (state: TypedState) => {
  const profile = state.profile

  if (
    !profile.platform ||
    profile.platform === 'zcash' ||
    profile.platform === 'btc' ||
    profile.platform === 'dnsOrGenericWebSite' ||
    profile.platform === 'pgp' ||
    profile.platform === 'pgpg'
  ) {
    throw new Error(`Invalid profile platform in PostProofContainer: ${profile.platform || ''}`)
  }

  const platform: ProvablePlatformsType = profile.platform

  return {
    errorMessage: profile.errorText,
    isOnCompleteWaiting: profile.waiting,
    onCancelText: 'Cancel',
    platform,
    platformUserName: profile.username,
    proofText: profile.proofText || '',
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => dispatch(cancelAddProof()),
  onComplete: () => dispatch(checkProof()),
  proofAction: () => dispatch(outputInstructionsActionLink()),
})

export default connect(mapStateToProps, mapDispatchToProps)(PostProof)
