import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import Success from '.'

export default Container.namedConnect(
  state => ({
    errorText: state.profile.errorCode !== null ? state.profile.errorText || 'Failed to verify proof' : '',
    proofUsername: state.profile.username + state.profile.platformGenericParams?.suffix ?? '@unknown',
    serviceIcon: state.profile.platformGenericParams?.logoFull ?? [],
  }),
  dispatch => ({
    onClose: () => {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(ProfileGen.createBackToProfile())
      dispatch(ProfileGen.createClearPlatformGeneric())
    },
  }),
  (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps}),
  'GenericProofSuccess'
)(Success)
