import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as WalletsTypes from '../../../constants/types/wallets'
import PaymentsConfirm from '.'
import * as Container from '../../../util/container'

type OwnProps = {}

export default Container.namedConnect(
  state => {
    const pinfo = state.chat2.paymentConfirmInfo
    const payments = pinfo?.summary?.payments ?? []
    const errorIsNoWallet = pinfo?.error?.code === RPCTypes.StatusCode.scstellarmissingbundle
    return {
      displayTotal: pinfo?.summary?.displayTotal ?? '',
      error: errorIsNoWallet ? 'Wallet needed to send money in chat.' : pinfo?.error?.desc,
      errorIsNoWallet,
      loading: !pinfo,
      payments,
      xlmTotal: pinfo?.summary?.xlmTotal ?? '',
    }
  },
  dispatch => ({
    onAccept: () => dispatch(Chat2Gen.createConfirmScreenResponse({accept: true})),
    onCancel: () => dispatch(Chat2Gen.createConfirmScreenResponse({accept: false})),
    onWallet: () => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(Chat2Gen.createConfirmScreenResponse({accept: false}))
      dispatch(
        WalletsGen.createSelectAccount({
          accountID: WalletsTypes.noAccountID,
          reason: 'from-chat',
          show: true,
        })
      )
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'PaymentsConfirm'
)(PaymentsConfirm)
