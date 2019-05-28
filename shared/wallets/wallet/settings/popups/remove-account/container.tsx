import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RemoveAccountPopup from '.'

type OwnProps = Container.RouteProps<
  {
    accountID: Types.AccountID
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const accountID = Container.getRouteProps(ownProps, 'accountID')
  const account = Constants.getAccount(state, accountID)

  return {
    accountID,
    balance: account.balanceDescription,
    name: account.name,
  }
}

const mapDispatchToProps = dispatch => ({
  _onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  _onDelete: (accountID: Types.AccountID) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {accountID},
            selected: 'reallyRemoveAccount',
          },
        ],
      })
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  balance: stateProps.balance,
  name: stateProps.name,
  onClose: () => dispatchProps._onClose(),
  onDelete: () => dispatchProps._onDelete(stateProps.accountID),
})

export default Container.namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'RemoveAccountPopup')(
  RemoveAccountPopup
)
