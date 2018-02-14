// @flow
import * as ProfileGen from '../actions/profile-gen'
import PostProof from './post-proof'
import {compose, connect, lifecycle, withStateHandlers, type TypedState} from '../util/container'
import {type ProvablePlatformsType} from '../constants/types/more'

const mapStateToProps = (state: TypedState, {onAllowProofCheck}) => {
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
  onCancel: () => dispatch(ProfileGen.createCancelAddProof()),
  onComplete: () => dispatch(ProfileGen.createCheckProof()),
  proofAction: () => dispatch(ProfileGen.createOutputInstructionsActionLink()),
})

export default compose(
  withStateHandlers(({allowProofCheck: boolean}) => ({allowProofCheck: true}), {
    onAllowProofCheck: () => (allowProofCheck: boolean) => ({allowProofCheck}),
  }),
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      // Facebook proof checking gets enabled after they click continue.
      if (this.props.platform === 'facebook') {
        this.props.onAllowProofCheck(false)
      }
    },
  })
)(PostProof)
