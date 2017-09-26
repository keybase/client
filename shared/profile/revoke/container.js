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
    if (routeProps.get('platform') === 'pgp') {
      dispatch(dropPgp(routeProps.get('proofId')))
    } else {
      dispatch(submitRevokeProof(routeProps.get('proofId')))
    }
  },
  platform: routeProps.get('platform'),
  platformHandle: routeProps.get('platformHandle'),
}))(Revoke)
