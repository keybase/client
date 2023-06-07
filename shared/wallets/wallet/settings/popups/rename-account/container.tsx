import capitalize from 'lodash/capitalize'
import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import RenameAccount from '.'

type OwnProps = {accountID: Types.AccountID}

export default (ownProps: OwnProps) => {
  const accountID = ownProps.accountID ?? Types.noAccountID
  const selectedAccount = Container.useSelector(state => Constants.getAccount(state, accountID))
  const error = Container.useSelector(state => state.wallets.accountNameError)
  const initialName = selectedAccount.name
  const nameValidationState = Container.useSelector(state => state.wallets.accountNameValidationState)
  const renameAccountError = Container.useSelector(state => state.wallets.createNewAccountError)
  const waiting = Container.useAnyWaiting([
    Constants.changeAccountNameWaitingKey,
    Constants.validateAccountNameWaitingKey,
  ])

  const dispatch = Container.useDispatch()
  const _onChangeAccountName = (accountID: Types.AccountID, name: string) => {
    dispatch(WalletsGen.createChangeAccountName({accountID, name}))
  }
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClearErrors = () => {
    dispatch(WalletsGen.createClearErrors())
  }
  const onDone = (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  }
  const props = {
    error: capitalize(error),
    initialName: initialName,
    nameValidationState: nameValidationState,
    onCancel: onCancel,
    onChangeAccountName: (name: string) => _onChangeAccountName(accountID, name),
    onClearErrors: onClearErrors,
    onDone: onDone,
    renameAccountError: renameAccountError,
    waiting: waiting,
  }
  return <RenameAccount {...props} />
}
