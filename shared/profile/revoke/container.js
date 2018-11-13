// @flow
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import {connect, type RouteProps} from '../../util/container'
import type {PlatformsExpandedType} from '../../constants/types/more'

type OwnProps = RouteProps<
  {
    platform: PlatformsExpandedType,
    platformHandle: string,
    proofId: string,
  },
  {}
>

const mapStateToProps = (state, {routeProps}) => ({
  errorMessage: state.profile.revoke.error,
  isWaiting: !!state.profile.revoke.waiting,
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

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d) => ({...s, ...d})
)(Revoke)
