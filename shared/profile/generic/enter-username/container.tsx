import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import openURL from '../../../util/open-url'
import EnterUsername from '.'

type OwnProps = Container.RouteProps

const mapStateToProps = state => {
  const {profile} = state
  const {username, platformGenericParams, platformGenericURL, errorText, platformGenericChecking} = profile
  return {
    _platformURL: platformGenericURL,
    error: errorText,
    serviceIcon: platformGenericParams?.logoBlack ?? [],
    serviceIconFull: platformGenericParams?.logoFull ?? [],
    serviceName: platformGenericParams?.title ?? '',
    serviceSub: platformGenericParams?.subtext ?? '',
    serviceSuffix: platformGenericParams?.suffix ?? '',
    submitButtonLabel: platformGenericParams?.buttonLabel ?? 'Submit',
    unreachable: !!platformGenericURL,
    username: username,
    waiting: platformGenericChecking,
  }
}

const mapDispatchToProps = dispatch => ({
  onBack: () => {
    dispatch(ProfileGen.createCancelAddProof())
    dispatch(RouteTreeGen.createClearModals())
  },
  onChangeUsername: username => dispatch(ProfileGen.createUpdateUsername({username})),
  onContinue: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileGenericProofResult']})),
  onSubmit: () => dispatch(ProfileGen.createSubmitUsername()),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  error: stateProps.error,
  onBack: dispatchProps.onBack,
  onCancel: dispatchProps.onBack,
  onChangeUsername: dispatchProps.onChangeUsername,
  onContinue: dispatchProps.onContinue,
  onSubmit: stateProps._platformURL ? () => openURL(stateProps._platformURL) : dispatchProps.onSubmit,
  serviceIcon: stateProps.serviceIcon,
  serviceIconFull: stateProps.serviceIconFull,
  serviceName: stateProps.serviceName,
  serviceSub: stateProps.serviceSub,
  serviceSuffix: stateProps.serviceSuffix,
  submitButtonLabel: stateProps.submitButtonLabel,
  unreachable: stateProps.unreachable,
  username: stateProps.username,
  waiting: stateProps.waiting,
})

const ConnectedEnterUsername = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEnterUsername'
)(EnterUsername)

export default ConnectedEnterUsername
