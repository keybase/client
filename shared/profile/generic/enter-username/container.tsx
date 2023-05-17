import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import openURL from '../../../util/open-url'
import EnterUsername from '.'

const ConnectedEnterUsername = () => {
  const profile = Container.useSelector(state => state.profile)
  const {username, platformGenericParams, platformGenericURL, errorText, platformGenericChecking} = profile
  const _platformURL = platformGenericURL
  const error = errorText
  const serviceIcon = platformGenericParams?.logoBlack ?? []
  const serviceIconFull = platformGenericParams?.logoFull ?? []
  const serviceName = platformGenericParams?.title ?? ''
  const serviceSub = platformGenericParams?.subtext ?? ''
  const serviceSuffix = platformGenericParams?.suffix ?? ''
  const submitButtonLabel = platformGenericParams?.buttonLabel ?? 'Submit'
  const unreachable = !!platformGenericURL
  const waiting = platformGenericChecking

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(ProfileGen.createCancelAddProof())
    dispatch(RouteTreeGen.createClearModals())
  }
  const onChangeUsername = (username: string) => {
    dispatch(ProfileGen.createUpdateUsername({username}))
  }
  const onContinue = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['profileGenericProofResult']}))
  }
  const onSubmit = () => {
    dispatch(ProfileGen.createSubmitUsername())
  }
  const props = {
    error: error,
    onBack: onBack,
    onCancel: onBack,
    onChangeUsername: onChangeUsername,
    onContinue: onContinue,
    onSubmit: _platformURL ? () => _platformURL && openURL(_platformURL) : onSubmit,
    serviceIcon: serviceIcon,
    serviceIconFull: serviceIconFull,
    serviceName: serviceName,
    serviceSub: serviceSub,
    serviceSuffix: serviceSuffix,
    submitButtonLabel: submitButtonLabel,
    unreachable: unreachable,
    username: username,
    waiting: waiting,
  }
  return <EnterUsername {...props} />
}
export default ConnectedEnterUsername
