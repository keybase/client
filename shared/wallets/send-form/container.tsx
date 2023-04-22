import SendRequestForm from '.'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<'sendReceiveForm'>

export default (ownProps: OwnProps) => {
  const isRequest = Container.useSelector(state => state.wallets.building.isRequest)
  const dispatch = Container.useDispatch()
  const isAdvanced = ownProps.route.params?.isAdvanced ?? false
  const onBack = isAdvanced
    ? () => dispatch(RouteTreeGen.createNavigateUp())
    : Container.isMobile
    ? () => dispatch(WalletsGen.createAbandonPayment())
    : null
  const onClose = () => {
    dispatch(WalletsGen.createAbandonPayment())
  }
  const props = {
    isAdvanced: ownProps.route.params?.isAdvanced ?? false,
    isRequest,
    onBack,
    onClose,
  }
  return <SendRequestForm {...props} />
}
