import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Types from '../../../../../constants/types/wallets'
import {anyWaiting} from '../../../../../constants/waiting'
import ReallyRemoveAccountPopup from '.'

type OwnProps = Container.RouteProps<{accountID: Types.AccountID}>

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
    const secretKey = Constants.getSecretKey(state, accountID).stringValue()

    return {
      accountID,
      loading: !secretKey,
      name: Constants.getAccount(state, accountID).name,
      secretKey,
      waiting: anyWaiting(state, Constants.deleteAccountWaitingKey),
    }
  },
  dispatch => ({
    _onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
    _onCopyKey: (secretKey: string) => dispatch(ConfigGen.createCopyToClipboard({text: secretKey})),
    _onFinish: (accountID: Types.AccountID) =>
      dispatch(
        WalletsGen.createDeleteAccount({
          accountID,
        })
      ),
    _onLoadSecretKey: (accountID: Types.AccountID) => dispatch(WalletsGen.createExportSecretKey({accountID})),
    _onSecretKeySeen: (accountID: Types.AccountID) => dispatch(WalletsGen.createSecretKeySeen({accountID})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    loading: stateProps.loading,
    name: stateProps.name,
    onCancel: () => dispatchProps._onClose(),
    onCopyKey: () => dispatchProps._onCopyKey(stateProps.secretKey),
    onFinish: () => dispatchProps._onFinish(stateProps.accountID),
    onLoadSecretKey: () => dispatchProps._onLoadSecretKey(stateProps.accountID),
    onSecretKeySeen: () => dispatchProps._onSecretKeySeen(stateProps.accountID),
    waiting: stateProps.waiting,
  }),
  'ReallyRemoveAccountPopup'
)(ReallyRemoveAccountPopup)
