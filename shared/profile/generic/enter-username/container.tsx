import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import openURL from '../../../util/open-url'
import EnterUsername from '.'

type OwnProps = Container.RouteProps

const mapStateToProps = state => ({
  _platformURL: state.profile.platformGenericURL,
  error: state.profile.errorText,
  // Auto generated from flowToTs. Please clean me!
  serviceIcon:
    (state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.logoBlack) || [],
  // Auto generated from flowToTs. Please clean me!
  serviceIconFull:
    (state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.logoFull) || [],
  // Auto generated from flowToTs. Please clean me!
  serviceName:
    (state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.title) || '',
  // Auto generated from flowToTs. Please clean me!
  serviceSub:
    (state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.subtext) || '',
  // Auto generated from flowToTs. Please clean me!
  serviceSuffix:
    (state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.suffix) || '',
  // Auto generated from flowToTs. Please clean me!
  submitButtonLabel:
    (state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.buttonLabel) || 'Submit',
  unreachable: !!state.profile.platformGenericURL,
  username: state.profile.username,
  waiting: state.profile.platformGenericChecking,
})

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
