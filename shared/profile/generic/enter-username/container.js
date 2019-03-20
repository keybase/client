// @flow
import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import EnterUsername from '.'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.profile.errorText,
  serviceIcon: state.profile.platformGenericParams?.logoBlack || [],
  serviceIconFull: state.profile.platformGenericParams?.logoFull || [],
  serviceName: state.profile.platformGenericParams?.title || '',
  serviceSub: state.profile.platformGenericParams?.subtext || '',
  serviceSuffix: state.profile.platformGenericParams?.suffix || '',
  submitButtonLabel: state.profile.platformGenericParams?.buttonLabel || 'Submit',
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(ProfileGen.createCancelAddProof()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  error: stateProps.error,
  onBack: dispatchProps.onBack,
  onChangeUsername: () => {},
  onSubmit: () => {},
  serviceIcon: stateProps.serviceIcon,
  serviceIconFull: stateProps.serviceIconFull,
  serviceName: stateProps.serviceName,
  serviceSub: stateProps.serviceSub,
  serviceSuffix: stateProps.serviceSuffix,
  submitButtonLabel: stateProps.submitButtonLabel,
  unreachable: false,
  username: '',
})

const ConnectedEnterUsername = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEnterUsername'
)(EnterUsername)

export default ConnectedEnterUsername
