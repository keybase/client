import QRScan from '.'
import logger from '../../logger'
import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = Container.RouteProps

const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onSubmitCode: (to: string | null) => {
    if (to) {
      dispatch(WalletsGen.createSetBuildingRecipientType({recipientType: 'stellarPublicKey'}))
      dispatch(WalletsGen.createSetBuildingTo({to}))
    } else {
      logger.warn('QrScan.onSubmitCode: No `to` field for QRScan')
    }
    dispatch(RouteTreeGen.createNavigateUp())
  },
})
const mergeProps = (_, dispatchProps, __: OwnProps) => ({
  ...dispatchProps,
})

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.safeSubmitPerMount(['onSubmitCode'])
)(QRScan)
