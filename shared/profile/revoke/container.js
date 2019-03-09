// @flow
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import flags from '../../util/feature-flags'
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

const mapStateToProps = (state, {routeProps, navigation}) => {
  const platform = flags.useNewRouter ? navigation.getParam('platform') : routeProps.get('platform')
  const platformHandle = flags.useNewRouter
    ? navigation.getParam('platformHandle')
    : routeProps.get('platformHandle')
  return {
    errorMessage: state.profile.revokeError,
    isWaiting: Waiting.anyWaiting(state, Constants.waitingKey),
    platform,
    platformHandle,
  }
}

const mapDispatchToProps = (dispatch, {routeProps, navigation}) => ({
  onCancel: () => dispatch(ProfileGen.createFinishRevoking()),
  onRevoke: () => {
    const platform = flags.useNewRouter ? navigation.getParam('platform') : routeProps.get('platform')
    const proofId = flags.useNewRouter ? navigation.getParam('proofId') : routeProps.get('proofId')
    if (platform === 'pgp') {
      dispatch(ProfileGen.createDropPgp({kid: proofId}))
    } else {
      dispatch(ProfileGen.createSubmitRevokeProof({proofId}))
    }
  },
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d) => ({...s, ...d})
)(Revoke)
