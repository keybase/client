// @flow
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  errorMessage: state.profile.revoke.error,
  isWaiting: state.profile.revoke.waiting,
  platform: routeProps.get('platform'),
  platformHandle: routeProps.get('platformHandle'),
})

const mapDispatchToProps = (dispatch, {routeProps}) => ({
  onCancel: () => dispatch(ProfileGen.createFinishRevoking()),
  onRevoke: () => {
    if (routeProps.get('platform') === 'pgp') {
      dispatch(ProfileGen.createDropPgp({kid: routeProps.get('proofId')}))
    } else {
      dispatch(ProfileGen.createSubmitRevokeProof({proofId: routeProps.get('proofId')}))
    }
  },
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d, ...o}))(Revoke)
