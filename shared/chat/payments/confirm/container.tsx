import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as WalletsTypes from '../../../constants/types/wallets'
import PaymentsConfirm from '.'
import * as Container from '../../../util/container'

export default () => {
  const pinfo = Container.useSelector(state => state.chat2.paymentConfirmInfo)
  const payments = pinfo?.summary?.payments ?? []
  const errorIsNoWallet = pinfo?.error?.code === RPCTypes.StatusCode.scstellarmissingbundle
  const displayTotal = pinfo?.summary?.displayTotal ?? ''
  const error = errorIsNoWallet ? 'Wallet needed to send money in chat.' : pinfo?.error?.desc
  const loading = !pinfo
  const xlmTotal = pinfo?.summary?.xlmTotal ?? ''

  const dispatch = Container.useDispatch()
  const onAccept = () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: true}))
  }
  const onCancel = () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: false}))
  }
  const onWallet = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: false}))
    dispatch(
      WalletsGen.createSelectAccount({
        accountID: WalletsTypes.noAccountID,
        reason: 'from-chat',
        show: true,
      })
    )
  }
  const props = {
    displayTotal,
    error,
    loading,
    onAccept,
    onCancel,
    onWallet,
    payments,
    xlmTotal,
  }
  return <PaymentsConfirm {...props} />
}
