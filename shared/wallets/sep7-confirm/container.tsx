import * as Chat2Gen from '../../actions/chat2-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as WalletsTypes from '../../constants/types/wallets'
import PaymentsConfirm from '.'
import {namedConnect} from '../../util/container'

type OwnProps = {}

const mapStateToProps = (state, ownProps: OwnProps) => ({})

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

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'PaymentsConfirm'
)(PaymentsConfirm)
