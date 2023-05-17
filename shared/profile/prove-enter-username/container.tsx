import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import ProveEnterUsername from '.'

export default () => {
  const profile = Container.useSelector(state => state.profile)

  if (!profile.platform) {
    throw new Error('No platform passed to prove enter username')
  }

  const errorText = profile.errorText === 'Input canceled' ? '' : profile.errorText
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
