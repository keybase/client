// @flow
import {namedConnect, type RouteProps} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import {anyWaiting} from '../../../../../constants/waiting'
import SetDefaultAccountPopup from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')

  return {
    accountID,
    accountName: Constants.getAccount(state, accountID).name,
    username: state.config.username,
    waiting: anyWaiting(state, Constants.setAccountAsDefaultWaitingKey),
  }
}
const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onAccept: (accountID: Types.AccountID) =>
    dispatch(
      WalletsGen.createSetAccountAsDefault({
        accountID,
      })
    ),
  _onClose: () => dispatch(navigateUp()),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  accountName: stateProps.accountName,
  onAccept: () => dispatchProps._onAccept(stateProps.accountID),
  onClose: () => dispatchProps._onClose(),
  username: stateProps.username,
  waiting: stateProps.waiting,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SetDefaultAccountPopup'
)(SetDefaultAccountPopup)
