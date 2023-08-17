import * as C from '../../constants'
import ProveEnterUsername from '.'

export default () => {
  const platform = C.useProfileState(s => s.platform)
  const username = C.useProfileState(s => s.username)
  const _errorText = C.useProfileState(s => s.errorText)
  const updateUsername = C.useProfileState(s => s.dispatch.updateUsername)
  const cancelAddProof = C.useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const submitBTCAddress = C.useProfileState(s => s.dispatch.submitBTCAddress)
  const submitZcashAddress = C.useProfileState(s => s.dispatch.submitZcashAddress)
  const submitUsername = C.useProfileState(s => s.dispatch.dynamic.submitUsername)

  if (!platform) {
    throw new Error('No platform passed to prove enter username')
  }

  const errorText = _errorText === 'Input canceled' ? '' : _errorText

  const _onSubmit = (username: string, platform?: string) => {
    updateUsername(username)

    if (platform === 'btc') {
      submitBTCAddress()
    } else if (platform === 'zcash') {
      submitZcashAddress()
    } else {
      submitUsername?.()
    }
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    cancelAddProof?.()
    clearModals()
  }
  const props = {
    errorText: errorText,
    onCancel: onCancel,
    onSubmit: (username: string) => _onSubmit(username, platform),
    platform: platform,
    username: username,
  }
  return <ProveEnterUsername {...props} />
}
