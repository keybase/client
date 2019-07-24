import * as ConfigGen from '../../actions/config-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import PostProof from '.'
import {connect} from '../../util/container'

type OwnProps = {}

const mapStateToProps = state => {
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

  const platform = profile.platform

  let url = ''
  let openLinkBeforeSubmit = false
  let proofText = profile.proofText || ''
  switch (platform) {
    case 'twitter':
      openLinkBeforeSubmit = true
      url = profile.proofText ? `https://twitter.com/home?status=${profile.proofText || ''}` : ''
      break
    case 'github':
      openLinkBeforeSubmit = true
      url = 'https://gist.github.com/'
      break
    case 'reddit': // fallthrough
    case 'facebook':
      openLinkBeforeSubmit = true
      url = profile.proofText ? profile.proofText : ''
      proofText = ''
      break
    case 'hackernews':
      openLinkBeforeSubmit = true
      url = `https://news.ycombinator.com/user?id=${profile.username || ''}`
      break
    default:
      break
  }

  return {
    errorMessage: profile.errorText,
    openLinkBeforeSubmit,
    platform,
    platformUserName: profile.username,
    proofText,
    url,
  }
}

const mapDispatchToProps = dispatch => ({
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  onCancel: () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ProfileGen.createCancelAddProof())
  },
  onSubmit: () => dispatch(ProfileGen.createCheckProof()),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  copyToClipboard: dispatchProps.copyToClipboard,
  errorMessage: stateProps.errorMessage,
  onCancel: dispatchProps.onCancel,
  onSubmit: dispatchProps.onSubmit,
  openLinkBeforeSubmit: stateProps.openLinkBeforeSubmit,
  platform: stateProps.platform,
  platformUserName: stateProps.platformUserName,
  proofText: stateProps.proofText,
  url: stateProps.url,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(PostProof)
