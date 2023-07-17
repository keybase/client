import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as Types from '../../constants/types/wallets'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import RemoveAccountPopup from '.'

type OwnProps = {accountID: Types.AccountID}

export default (ownProps: OwnProps) => {
  const accountID = ownProps.accountID ?? Types.noAccountID
  const account = Container.useSelector(state => Constants.getAccount(state, accountID))
  const balance = account.balanceDescription
  const name = account.name
  const _onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const _onDelete = (accountID: Types.AccountID) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {accountID}, selected: 'reallyRemoveAccount'}],
      })
    )
  }
  const dispatch = Container.useDispatch()
  const props = {
    balance: balance,
    name: name,
    onClose: () => _onClose(),
    onDelete: () => _onDelete(accountID),
  }
  return <RemoveAccountPopup {...props} />
}
