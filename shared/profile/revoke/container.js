// @flow
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import {connect, getRouteProps, type RouteProps} from '../../util/container'
import type {PlatformsExpandedType} from '../../constants/types/more'

type OwnProps = RouteProps<
  {
    platform: PlatformsExpandedType,
    platformHandle: string,
    proofId: string,
  },
  {}
>

const mapStateToProps = (state, ownProps) => ({
  errorMessage: state.profile.revokeError,
  isWaiting: Waiting.anyWaiting(state, Constants.waitingKey),
  platform: getRouteProps(ownProps, 'platform'),
  platformHandle: getRouteProps(ownProps, 'platformHandle'),
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  onCancel: () => {
    dispatch(ProfileGen.createFinishRevoking())
    dispatch(RouteTreeGen.createClearModals())
  },
  onRevoke: () => {
    const proofId = getRouteProps(ownProps, 'proofId')
    proofId && dispatch(ProfileGen.createSubmitRevokeProof({proofId}))
    dispatch(RouteTreeGen.createClearModals())
  },
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d) => ({...s, ...d})
)(Revoke)
