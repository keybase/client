import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/profile'
import ProveEnterUsername from '.'

export default () => {
  const platform = Constants.useState(s => s.platform)
  const username = Constants.useState(s => s.username)
  const _errorText = Constants.useState(s => s.errorText)
  const updateUsername = Constants.useState(s => s.dispatch.updateUsername)
  const cancelAddProof = Constants.useState(s => s.dispatch.dynamic.cancelAddProof)
  const submitBTCAddress = Constants.useState(s => s.dispatch.submitBTCAddress)
  const submitZcashAddress = Constants.useState(s => s.dispatch.submitZcashAddress)
  const submitUsername = Constants.useState(s => s.dispatch.dynamic.submitUsername)

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
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
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
