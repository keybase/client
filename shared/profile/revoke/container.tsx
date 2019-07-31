import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import * as Container from '../../util/container'
import {PlatformsExpandedType} from '../../constants/types/more'
import {SiteIconSet} from '../../constants/types/tracker2'

type OwnProps = Container.RouteProps<{
  icon: SiteIconSet
  platform: PlatformsExpandedType
  platformHandle: string
  proofId: string
}>

const noIcon = []

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    errorMessage: state.profile.revokeError,
    icon: Container.getRouteProps(ownProps, 'icon', noIcon),
    isWaiting: Waiting.anyWaiting(state, Constants.waitingKey),
    platform: Container.getRouteProps(ownProps, 'platform', 'http'),
    platformHandle: Container.getRouteProps(ownProps, 'platformHandle', ''),
  }),
  (dispatch, ownProps: OwnProps) => ({
    onCancel: () => {
      dispatch(ProfileGen.createFinishRevoking())
      dispatch(RouteTreeGen.createClearModals())
    },
    onRevoke: () => {
      const proofId = Container.getRouteProps(ownProps, 'proofId', '')
      proofId && dispatch(ProfileGen.createSubmitRevokeProof({proofId}))
      dispatch(RouteTreeGen.createClearModals())
    },
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(Revoke)
