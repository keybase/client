// @flow
import QRScan from '.'
import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onSubmitCode: (to: ?string) => {
    if (to) {
      dispatch(WalletsGen.createSetBuildingRecipientType({recipientType: 'stellarPublicKey'}))
      dispatch(WalletsGen.createSetBuildingTo({to}))
    }
    dispatch(RouteTreeGen.createNavigateUp())
  },
})
const mergeProps = (stateProps, dispatchProps) => ({
  ...dispatchProps,
})

export default Container.compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Container.safeSubmitPerMount(['onSubmitCode'])
)(QRScan)
