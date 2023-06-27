import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/profile'
import ProveEnterUsername from '.'

export default () => {
  const profile = Container.useSelector(state => state.profile)
  const _errorText = Constants.useState(s => s.errorText)

  if (!profile.platform) {
    throw new Error('No platform passed to prove enter username')
  }

  const errorText = _errorText === 'Input canceled' ? '' : _errorText
  const platform = profile.platform
  const username = profile.username

  const dispatch = Container.useDispatch()
  const _onSubmit = (username: string, platform?: string) => {
    dispatch(ProfileGen.createUpdateUsername({username}))

    if (platform === 'btc') {
      dispatch(ProfileGen.createSubmitBTCAddress())
    } else if (platform === 'zcash') {
      dispatch(ProfileGen.createSubmitZcashAddress())
    } else {
      dispatch(ProfileGen.createSubmitUsername())
    }
  }
  const onCancel = () => {
    dispatch(ProfileGen.createCancelAddProof())
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
