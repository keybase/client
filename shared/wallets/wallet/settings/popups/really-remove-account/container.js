// @flow
import {compose, connect, setDisplayName, type TypedState} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Types from '../../../../../constants/types/wallets'
import {anyWaiting} from '../../../../../constants/waiting'
import ReallyRemoveAccountPopup from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => {
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
  waiting: stateProps.waiting,
  onCancel: () => dispatchProps._onClose(stateProps.accountID),
  onCopyKey: () => dispatchProps._onCopyKey(stateProps.secretKey),
  onFinish: () => dispatchProps._onFinish(stateProps.accountID),
  onLoadSecretKey: () => dispatchProps._onLoadSecretKey(stateProps.accountID),
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('ReallyRemoveAccountPopup')
)(ReallyRemoveAccountPopup)
