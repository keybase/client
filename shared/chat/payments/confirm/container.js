// @flow
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as WalletsTypes from '../../../constants/types/wallets'
import PaymentsConfirm from '.'
import {namedConnect} from '../../../util/container'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const pinfo = state.chat2.paymentConfirmInfo
  const payments = pinfo?.summary?.payments || []
  const errorIsNoWallet = pinfo?.error?.code === RPCTypes.constantsStatusCode.scstellarmissingbundle
  return {
    displayTotal: pinfo?.summary?.displayTotal,
    error: errorIsNoWallet ? 'Wallet needed to send money in chat.' : pinfo?.error?.desc,
    errorIsNoWallet,
    loading: !pinfo,
    payments,
    xlmTotal: pinfo?.summary?.xlmTotal,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
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

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'PaymentsConfirm'
)(PaymentsConfirm)
