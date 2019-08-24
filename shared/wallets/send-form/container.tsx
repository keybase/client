import SendRequestForm from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<{isAdvanced: boolean}>

export default Container.connect(
  state => ({isRequest: state.wallets.building.isRequest}),
  (dispatch, ownProps: OwnProps) => {
    const isAdvanced = Container.getRouteProps(ownProps, 'isAdvanced', false)
    return {
      onBack: isAdvanced
        ? () => dispatch(RouteTreeGen.createNavigateUp())
        : Container.isMobile
        ? () => dispatch(WalletsGen.createAbandonPayment())
        : null,
      onClose: () => dispatch(WalletsGen.createAbandonPayment()),
    }
  },
  ({isRequest}, {onBack, onClose}, ownProps) => ({
    isAdvanced: Container.getRouteProps(ownProps, 'isAdvanced', false),
    isRequest,
    onBack,
    onClose,
  })
)(SendRequestForm)
