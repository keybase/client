import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {anyWaiting} from '../../../../../constants/waiting'
import SetDefaultAccountPopup from '.'

type OwnProps = Container.RouteProps<
  {
    accountID: Types.AccountID
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const accountID = Container.getRouteProps(ownProps, 'accountID')

  return {
    accountID,
    accountName: Constants.getAccount(state, accountID).name,
    username: state.config.username,
    waiting: anyWaiting(state, Constants.setAccountAsDefaultWaitingKey),
  }
}
const mapDispatchToProps = dispatch => ({
  _onAccept: (accountID: Types.AccountID) =>
    dispatch(
      WalletsGen.createSetAccountAsDefault({
        accountID,
      })
    ),
  _onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  accountName: stateProps.accountName,
  onAccept: () => dispatchProps._onAccept(stateProps.accountID),
  onClose: () => dispatchProps._onClose(),
  username: stateProps.username,
  waiting: stateProps.waiting,
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SetDefaultAccountPopup'
)(SetDefaultAccountPopup)
