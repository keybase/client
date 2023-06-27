import * as ConfigGen from '../../actions/config-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import PostProof from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile'

export default () => {
  const profile = Container.useSelector(state => state.profile)
  const errorText = Constants.useState(s => s.errorText)

  if (
    !profile.platform ||
    profile.platform === 'zcash' ||
    profile.platform === 'btc' ||
    profile.platform === 'dnsOrGenericWebSite' ||
    profile.platform === 'pgp'
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

  const platformUserName = profile.username

  const dispatch = Container.useDispatch()
  const copyToClipboard = (text: string) => {
    dispatch(ConfigGen.createCopyToClipboard({text}))
  }
  const onCancel = () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ProfileGen.createCancelAddProof())
  }
  const onSubmit = () => {
    dispatch(ProfileGen.createCheckProof())
  }
  const props = {
    copyToClipboard,
    errorMessage: errorText,
    onCancel,
    onSubmit,
    openLinkBeforeSubmit: openLinkBeforeSubmit,
    platform,
    platformUserName,
    proofText: proofText,
    url: url,
  }
  return <PostProof {...props} />
}
