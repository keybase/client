import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import Revoke from '.'
import * as Constants from '../../constants/profile'
import * as Waiting from '../../constants/waiting'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<'profileRevoke'>
const noIcon = []

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    errorMessage: state.profile.revokeError,
    icon: ownProps.route.params?.icon ?? noIcon,
    isWaiting: Waiting.anyWaiting(state, Constants.waitingKey),
    platform: ownProps.route.params?.platform ?? 'http',
    platformHandle: ownProps.route.params?.platformHandle ?? '',
  }),
  (dispatch, ownProps: OwnProps) => ({
    onCancel: () => {
      dispatch(ProfileGen.createFinishRevoking())
      dispatch(RouteTreeGen.createClearModals())
    },
    onRevoke: () => {
      const proofId = ownProps.route.params?.proofId ?? ''
      proofId && dispatch(ProfileGen.createSubmitRevokeProof({proofId}))
      dispatch(RouteTreeGen.createClearModals())
    },
  }),
  (s, d, _: OwnProps) => ({...s, ...d})
)(Revoke)
