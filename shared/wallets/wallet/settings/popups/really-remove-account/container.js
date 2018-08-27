// @flow
import {connect, type TypedState} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as ConfigGen from '../../../../../actions/config-gen'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as Types from '../../../../../constants/types/wallets'
import ReallyRemoveAccountPopup from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const secretKey = Constants.getSecretKey(state, accountID).stringValue()

  return {
    accountID,
    secretKey,
    name: Constants.getAccount(state, accountID).name,
  }
}
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onClose: () => dispatch(navigateUp()),
  _onCopyKey: (secretKey: string) => dispatch(ConfigGen.createCopyToClipboard({text: secretKey})),
  _onFinish: (accountID: Types.AccountID) =>
    dispatch(
      WalletsGen.createDeleteAccount({
        accountID,
      })
    ),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  name: stateProps.name,
  onCancel: () => dispatchProps._onClose(),
  onCopyKey: () => dispatchProps._onCopyKey(stateProps.accountID),
  onFinish: () => dispatchProps._onFinish(stateProps.accountID),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ReallyRemoveAccountPopup)
