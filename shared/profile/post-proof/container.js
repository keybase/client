// @flow
import * as ConfigGen from '../../actions/config-gen'
import * as ProfileGen from '../../actions/profile-gen'
import PostProof from '.'
import {compose, connect, lifecycle, withStateHandlers} from '../../util/container'
import {type ProvablePlatformsType} from '../../constants/types/more'

type OwnProps = {|
  onAllowProofCheck: boolean,
|}

const mapStateToProps = (state, {onAllowProofCheck}) => {
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
    platform,
    platformUserName: profile.username,
    proofText: profile.proofText || '',
  }
}

const mapDispatchToProps = dispatch => ({
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  onComplete: () => dispatch(ProfileGen.createCheckProof()),
  onLeftAction: () => dispatch(ProfileGen.createCancelAddProof()),
  proofAction: () => dispatch(ProfileGen.createOutputInstructionsActionLink()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  leftAction: 'cancel',
})

export default (compose(
  withStateHandlers(({allowProofCheck: boolean}) => ({allowProofCheck: true}), {
    onAllowProofCheck: () => (allowProofCheck: boolean) => ({allowProofCheck}),
  }),
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      // Activate the proof check after they've completed the first step for these services.
      if (['facebook', 'twitter', 'reddit', 'github', 'hackernews'].includes(this.props.platform)) {
        this.props.onAllowProofCheck(false)
      }
    },
  })
): any)(PostProof)
