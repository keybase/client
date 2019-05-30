import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Types from '../../../../../constants/types/wallets'
import {anyWaiting} from '../../../../../constants/waiting'
import ReallyRemoveAccountPopup from '.'

type OwnProps = Container.RouteProps<
  {
    accountID: Types.AccountID
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const accountID = Container.getRouteProps(ownProps, 'accountID')
  const secretKey = Constants.getSecretKey(state, accountID).stringValue()

  return {
    accountID,
    loading: !secretKey,
    name: Constants.getAccount(state, accountID).name,
    secretKey,
    waiting: anyWaiting(state, Constants.deleteAccountWaitingKey),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onClose: (accountID: Types.AccountID) => dispatch(RouteTreeGen.createNavigateUp()),
  _onCopyKey: (secretKey: string) => dispatch(ConfigGen.createCopyToClipboard({text: secretKey})),
  _onFinish: (accountID: Types.AccountID) => {
    dispatch(
      WalletsGen.createDeleteAccount({
        accountID,
      })
    )
    dispatch(RouteTreeGen.createClearModals())
  },
  _onLoadSecretKey: (accountID: Types.AccountID) => dispatch(WalletsGen.createExportSecretKey({accountID})),
  _onSecretKeySeen: (accountID: Types.AccountID) => dispatch(WalletsGen.createSecretKeySeen({accountID})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  loading: stateProps.loading,
  name: stateProps.name,
  onCancel: () => dispatchProps._onClose(stateProps.accountID),
  onCopyKey: () => dispatchProps._onCopyKey(stateProps.secretKey),
  onFinish: () => dispatchProps._onFinish(stateProps.accountID),
  onLoadSecretKey: () => dispatchProps._onLoadSecretKey(stateProps.accountID),
  onSecretKeySeen: () => dispatchProps._onSecretKeySeen(stateProps.accountID),
  waiting: stateProps.waiting,
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ReallyRemoveAccountPopup'
)(ReallyRemoveAccountPopup)
