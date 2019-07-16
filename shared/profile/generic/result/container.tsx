import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import Success from '.'

const mapStateToProps = state => ({
  errorText: state.profile.errorCode !== null ? state.profile.errorText || 'Failed to verify proof' : '',
  proofUsername:
    state.profile.username + // Auto generated from flowToTs. Please clean me!
    ((state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.suffix) || '@unknown'),
  // Auto generated from flowToTs. Please clean me!
  serviceIcon:
    (state.profile.platformGenericParams === null || state.profile.platformGenericParams === undefined
      ? undefined
      : state.profile.platformGenericParams.logoFull) || [],
})

const mapDispatchToProps = dispatch => ({
  onClose: () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ProfileGen.createBackToProfile())
    dispatch(ProfileGen.createClearPlatformGeneric())
  },
})

const mergeProps = (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'GenericProofSuccess')(
  Success
)
