import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import PostProof from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile'

export default () => {
  const platform = Constants.useState(s => s.platform)
  const errorText = Constants.useState(s => s.errorText)
  const username = Constants.useState(s => s.username)
  let proofText = Constants.useState(s => s.proofText)

  const cancelAddProof = Constants.useState(s => s.dispatch.cancelAddProof)
  const checkProof = Constants.useState(s => s.dispatch.checkProof)

  if (
    !platform ||
    platform === 'zcash' ||
    platform === 'btc' ||
    platform === 'dnsOrGenericWebSite' ||
    platform === 'pgp'
  ) {
    throw new Error(`Invalid profile platform in PostProofContainer: ${platform || ''}`)
  }

  let url = ''
  let openLinkBeforeSubmit = false
  switch (platform) {
    case 'twitter':
      openLinkBeforeSubmit = true
      url = proofText ? `https://twitter.com/home?status=${proofText || ''}` : ''
      break
    case 'github':
      openLinkBeforeSubmit = true
      url = 'https://gist.github.com/'
      break
    case 'reddit': // fallthrough
    case 'facebook':
      openLinkBeforeSubmit = true
      url = proofText ? proofText : ''
      proofText = ''
      break
    case 'hackernews':
      openLinkBeforeSubmit = true
      url = `https://news.ycombinator.com/user?id=${username || ''}`
      break
    default:
      break
  }

  const platformUserName = username

  const dispatch = Container.useDispatch()
  const copyToClipboard = (text: string) => {
    dispatch(ConfigGen.createCopyToClipboard({text}))
  }
  const onCancel = () => {
    dispatch(RouteTreeGen.createClearModals())
    cancelAddProof()
  }
  const onSubmit = checkProof
  const props = {
    copyToClipboard,
    errorMessage: errorText,
    onCancel,
    onSubmit,
    openLinkBeforeSubmit: openLinkBeforeSubmit,
    platform,
    platformUserName,
    proofText,
    url: url,
  }
  return <PostProof {...props} />
}
