// @flow
import {namedConnect, type RouteProps} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Types from '../../../../../constants/types/wallets'
import {anyWaiting} from '../../../../../constants/waiting'
import ReallyRemoveAccountPopup from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
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
  _onClose: (accountID: Types.AccountID) => {
    dispatch(WalletsGen.createSecretKeySeen({accountID}))
    dispatch(navigateUp())
  },
  _onCopyKey: (secretKey: string) => dispatch(ConfigGen.createCopyToClipboard({text: secretKey})),
  _onFinish: (accountID: Types.AccountID) =>
    dispatch(
      WalletsGen.createDeleteAccount({
        accountID,
      })
    ),
  _onLoadSecretKey: (accountID: Types.AccountID) => dispatch(WalletsGen.createExportSecretKey({accountID})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  loading: stateProps.loading,
  name: stateProps.name,
  onCancel: () => dispatchProps._onClose(stateProps.accountID),
  onCopyKey: () => dispatchProps._onCopyKey(stateProps.secretKey),
  onFinish: () => dispatchProps._onFinish(stateProps.accountID),
  onLoadSecretKey: () => dispatchProps._onLoadSecretKey(stateProps.accountID),
  waiting: stateProps.waiting,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ReallyRemoveAccountPopup'
)(ReallyRemoveAccountPopup)
