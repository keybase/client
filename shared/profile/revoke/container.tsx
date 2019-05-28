import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import {connect, getRouteProps, RouteProps} from '../../util/container'
import {PlatformsExpandedType} from '../../constants/types/more'
import {SiteIconSet} from '../../constants/types/tracker2'

type OwnProps = RouteProps<
  {
    icon: SiteIconSet
    platform: PlatformsExpandedType
    platformHandle: string
    proofId: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => ({
  errorMessage: state.profile.revokeError,
  icon: getRouteProps(ownProps, 'icon'),
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

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d) => ({...s, ...d})
)(Revoke)
