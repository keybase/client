import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile'
import ProveEnterUsername from '.'

export default () => {
  const platform = Constants.useState(s => s.platform)
  const username = Constants.useState(s => s.username)
  const _errorText = Constants.useState(s => s.errorText)
  const updateUsername = Constants.useState(s => s.dispatch.updateUsername)
  const cancelAddProof = Constants.useState(s => s.dispatch.cancelAddProof)
  const submitBTCAddress = Constants.useState(s => s.dispatch.submitBTCAddress)
  const submitZcashAddress = Constants.useState(s => s.dispatch.submitZcashAddress)
  const submitUsername = Constants.useState(s => s.dispatch.submitUsername)

  if (!platform) {
    throw new Error('No platform passed to prove enter username')
  }

  const errorText = _errorText === 'Input canceled' ? '' : _errorText

  const dispatch = Container.useDispatch()
  const _onSubmit = (username: string, platform?: string) => {
    updateUsername(username)

    if (platform === 'btc') {
      submitBTCAddress()
    } else if (platform === 'zcash') {
      submitZcashAddress()
    } else {
      submitUsername()
    }
  }
  const onCancel = () => {
    cancelAddProof()
    dispatch(RouteTreeGen.createClearModals())
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
