import * as C from '../../constants'
import * as ConfigConstants from '../../constants/config'
import PostProof from '.'

export default () => {
  const platform = C.useProfileState(s => s.platform)
  const errorText = C.useProfileState(s => s.errorText)
  const username = C.useProfileState(s => s.username)
  let proofText = C.useProfileState(s => s.proofText)

  const cancelAddProof = C.useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const checkProof = C.useProfileState(s => s.dispatch.checkProof)

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

  const copyToClipboard = ConfigConstants.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    clearModals()
    cancelAddProof?.()
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
