// @flow
import {connect, type TypedState} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import ReallyRemoveAccountPopup from '.'

// type Props = {|
//   name: string,
// onCopyKey: () => void,
// onClose: () => void,
// |}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const accountID = routeProps.get('accountID')

  return {
    accountID,
    name: Constants.getAccount(state, accountID).name,
  }
}
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onClose: () => dispatch(navigateUp()),
  _onCopyKey: (accountID: Types.AccountID) =>
    dispatch(
      WalletsGen.createSetAccountAsDefault({
        accountID,
      })
    ),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  name: stateProps.name,
  onCopyKey: () => dispatchProps._onCopyKey(stateProps.accountID),
  onClose: () => dispatchProps._onClose(),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ReallyRemoveAccountPopup)
