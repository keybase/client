import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RemoveAccountPopup from '.'

type OwnProps = Container.RouteProps<'removeAccount'>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const accountID = ownProps.route.params?.accountID ?? Types.noAccountID
    const account = Constants.getAccount(state, accountID)
    return {
      accountID,
      balance: account.balanceDescription,
      name: account.name,
    }
  },
  dispatch => ({
    _onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
    _onDelete: (accountID: Types.AccountID) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {accountID}, selected: 'reallyRemoveAccount'}],
        })
      )
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    balance: stateProps.balance,
    name: stateProps.name,
    onClose: () => dispatchProps._onClose(),
    onDelete: () => dispatchProps._onDelete(stateProps.accountID),
  })
)(RemoveAccountPopup)
