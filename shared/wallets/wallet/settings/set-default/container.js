// @flow
import {connect, type TypedState} from '../../../../util/container'
import * as Constants from '../../../../constants/wallets'
import * as Types from '../../../../constants/types/wallets'
import * as WalletsGen from '../../../../actions/wallets-gen'
import SetDefaultAccount from '.'

// type Props = {|
//   accountName: string,
//   onAccept: () => void,
//   onClose: () => void,
//   username: string,
// |}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  console.log('nathan test', state)
  const accountID = routeProps.get('accountID')
  console.log('nathan test', accountID)

  return {
    accountID,
    accountName: Constants.getAccount(state, accountID).name,
    username: state.config.username,
  }
}
const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onClose: () => dispatch(navigateUp()),
  _onAccept: (accountID: Types.AccountID) =>
    dispatch(
      WalletsGen.createSetAccountAsDefault({
        accountID,
      })
    ),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  accountName: stateProps.accountName,
  username: stateProps.username,
  onClose: () => dispatchProps._onClose(),
  onAccept: () => dispatchProps._onAccept(stateProps.accountID),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SetDefaultAccount)
