import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as WalletsTypes from '../../../constants/types/wallets'
import PaymentsConfirm from '.'
import {namedConnect} from '../../../util/container'

type OwnProps = {}

const mapStateToProps = (state) => {
  const pinfo = state.chat2.paymentConfirmInfo
  const payments = // Auto generated from flowToTs. Please clean me!
    ((pinfo === null || pinfo === undefined ? undefined : pinfo.summary) === null ||
    (pinfo === null || pinfo === undefined ? undefined : pinfo.summary) === undefined
      ? undefined
      : (pinfo === null || pinfo === undefined ? undefined : pinfo.summary).payments) || []
  const errorIsNoWallet = // Auto generated from flowToTs. Please clean me!
    ((pinfo === null || pinfo === undefined ? undefined : pinfo.error) === null ||
    (pinfo === null || pinfo === undefined ? undefined : pinfo.error) === undefined
      ? undefined
      : (pinfo === null || pinfo === undefined ? undefined : pinfo.error).code) ===
    RPCTypes.StatusCode.scstellarmissingbundle
  return {
    // Auto generated from flowToTs. Please clean me!
    displayTotal:
      (pinfo === null || pinfo === undefined ? undefined : pinfo.summary) === null ||
      (pinfo === null || pinfo === undefined ? undefined : pinfo.summary) === undefined
        ? undefined
        : (pinfo === null || pinfo === undefined ? undefined : pinfo.summary).displayTotal,
    error: errorIsNoWallet
      ? 'Wallet needed to send money in chat.' // Auto generated from flowToTs. Please clean me!
      : (pinfo === null || pinfo === undefined ? undefined : pinfo.error) === null ||
        (pinfo === null || pinfo === undefined ? undefined : pinfo.error) === undefined
      ? undefined
      : (pinfo === null || pinfo === undefined ? undefined : pinfo.error).desc,
    errorIsNoWallet,
    loading: !pinfo,
    payments,
    // Auto generated from flowToTs. Please clean me!
    xlmTotal:
      (pinfo === null || pinfo === undefined ? undefined : pinfo.summary) === null ||
      (pinfo === null || pinfo === undefined ? undefined : pinfo.summary) === undefined
        ? undefined
        : (pinfo === null || pinfo === undefined ? undefined : pinfo.summary).xlmTotal,
  }
}

const mapDispatchToProps = (dispatch) => ({
  onAccept: () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: true}))
  },
  onCancel: () => {
    dispatch(Chat2Gen.createConfirmScreenResponse({accept: false}))
  },
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
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
    (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'PaymentsConfirm'
)(PaymentsConfirm)
