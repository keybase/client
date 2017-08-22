// @flow
import Revoke from './index'
import {TypedConnector} from '../../util/typed-connect'
import {submitRevokeProof, finishRevoking, dropPgp} from '../../actions/profile'

const connector = new TypedConnector()

export default connector.connect((state, dispatch, {routeProps}) => ({
  isWaiting: state.profile.revoke.waiting,
  errorMessage: state.profile.revoke.error,
  onCancel: () => {
    dispatch(finishRevoking())
  },
  onRevoke: () => {
    if (routeProps.platform === 'pgp') {
      dispatch(dropPgp(routeProps.proofId))
    } else {
      dispatch(submitRevokeProof(routeProps.proofId))
    }
  },
  platform: routeProps.platform,
  platformHandle: routeProps.platformHandle,
}))(Revoke)
