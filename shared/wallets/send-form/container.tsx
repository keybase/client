import SendRequestForm from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {isMobile} from '../../constants/platform'

type OwnProps = Container.RouteProps

const mapStateToProps = state => ({
  isRequest: state.wallets.building.isRequest,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => {
  const isAdvanced = Container.getRouteProps<Boolean>(ownProps, 'isAdvanced') || false
  return {
    onBack: isAdvanced
      ? () => dispatch(RouteTreeGen.createNavigateUp())
      : isMobile
      ? () => dispatch(WalletsGen.createAbandonPayment())
      : null,
    onClose: () => dispatch(WalletsGen.createAbandonPayment()),
  }
}

const mergeProps = ({isRequest}, {onBack, onClose}, ownProps) => ({
  isAdvanced: Container.getRouteProps(ownProps, 'isAdvanced') || false,
  isRequest,
  onBack,
  onClose,
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(SendRequestForm)
