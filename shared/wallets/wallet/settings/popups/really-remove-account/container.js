// @flow
import {connect, type TypedState} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import ReallyRemoveAccountPopup from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  console.log(routeProps)
  const accountID = routeProps.get('accountID')

  return {
    accountID,
    name: Constants.getAccount(state, accountID).name,
  }
}
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onClose: () => dispatch(navigateUp()),
  _onCopyKey: (accountID: Types.AccountID) => console.log('copy key'),
  _onFinish: () => console.log('delete account'),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  name: stateProps.name,
  onCancel: () => dispatchProps._onClose(),
  onCopyKey: () => dispatchProps._onCopyKey(stateProps.accountID),
  onFinish: () => dispatchProps._onFinish(),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ReallyRemoveAccountPopup)
