// @flow
import Revoke from './index'
import {submitRevokeProof, finishRevoking, dropPgp} from '../../actions/profile'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  errorMessage: state.profile.revoke.error,
  isWaiting: state.profile.revoke.waiting,
  platform: routeProps.get('platform'),
  platformHandle: routeProps.get('platformHandle'),
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  onCancel: () => dispatch(finishRevoking()),
  onRevoke: () => {
    if (routeProps.get('platform') === 'pgp') {
      dispatch(dropPgp(routeProps.get('proofId')))
    } else {
      dispatch(submitRevokeProof(routeProps.get('proofId')))
    }
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(Revoke)
