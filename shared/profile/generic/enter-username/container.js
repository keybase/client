// @flow
import * as Container from '../../../util/container'
import * as ProfileGen from '../../../actions/profile-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import flags from '../../../util/feature-flags'
import openURL from '../../../util/open-url'
import EnterUsername from '.'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = state => ({
  _platformURL: state.profile.platformGenericURL,
  error: state.profile.errorText,
  serviceIcon: state.profile.platformGenericParams?.logoBlack || [],
  serviceIconFull: state.profile.platformGenericParams?.logoFull || [],
  serviceName: state.profile.platformGenericParams?.title || '',
  serviceSub: state.profile.platformGenericParams?.subtext || '',
  serviceSuffix: state.profile.platformGenericParams?.suffix || '',
  submitButtonLabel: state.profile.platformGenericParams?.buttonLabel || 'Submit',
  unreachable: !!state.profile.platformGenericURL,
  username: state.profile.username,
  waiting: state.profile.platformGenericChecking,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => {
    dispatch(ProfileGen.createCancelAddProof())
    if (flags.useNewRouter) {
      dispatch(RouteTreeGen.createClearModals())
    }
  },
  onChangeUsername: username => dispatch(ProfileGen.createUpdateUsername({username})),
  onSubmit: () => dispatch(ProfileGen.createSubmitUsername()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  error: stateProps.error,
  onBack: dispatchProps.onBack,
  onChangeUsername: dispatchProps.onChangeUsername,
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

const ConnectedEnterUsername = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEnterUsername'
)(EnterUsername)

export default ConnectedEnterUsername
