// @flow
import Revoke from './index'
import {submitRevokeProof, finishRevoking, dropPgp} from '../../actions/profile'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  errorMessage: state.profile.revoke.error,
  isWaiting: state.profile.revoke.waiting,
  platform: routeProps.platform,
  platformHandle: routeProps.platformHandle,
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(finishRevoking()),
  onRevoke: () => {
    if (routeProps.platform === 'pgp') {
      dispatch(dropPgp(routeProps.proofId))
    } else {
      dispatch(submitRevokeProof(routeProps.proofId))
    }
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(Revoke)
