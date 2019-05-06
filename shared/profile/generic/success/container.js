// @flow
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import Success from '.'

const mapStateToProps = state => ({
  proofUsername: state.profile.username + (state.profile.platformGenericParams?.suffix || '@unknown'),
  serviceIcon: state.profile.platformGenericParams?.logoFull || [],
})

const mapDispatchToProps = dispatch => ({
  onClose: () => {
    dispatch(RouteTreeGen.createClearModals())
    dispatch(ProfileGen.createBackToProfile())
    dispatch(ProfileGen.createClearPlatformGeneric())
  },
})

const mergeProps = (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps})

export default Container.namedConnect<{}, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'GenericProofSuccess'
)(Success)
