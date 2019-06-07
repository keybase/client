import {capitalize} from 'lodash-es'
import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {changeAccountName, validateAccountName} from '../../../../../actions/wallets-ui'
import {anyWaiting} from '../../../../../constants/waiting'
import RenameAccount from '.'

type OwnProps = Container.RouteProps<
  {
    accountID: Types.AccountID
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const accountID = Container.getRouteProps(ownProps, 'accountID')
  const selectedAccount = Constants.getAccount(state, accountID)
  return {
    accountID,
    initialName: selectedAccount.name,
    waiting: anyWaiting(
      state,
      Constants.changeAccountNameWaitingKey,
      Constants.validateAccountNameWaitingKey
    ),
  }
}

const mapDispatchToProps = dispatch => ({
  _onChangeAccountName: (accountID: Types.AccountID, newName: string) =>
    changeAccountName({accountID, newName}, dispatch),
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  onValidate: (name: string) => validateAccountName({name}, dispatch),
})

const mergeProps = (stateProps, dispatchProps) => ({
  initialName: stateProps.initialName,
  nameValidationState: stateProps.nameValidationState,
  onCancel: dispatchProps.onCancel,
  onChangeAccountName: name => dispatchProps._onChangeAccountName(stateProps.accountID, name),
  onClearErrors: dispatchProps.onClearErrors,
  onValidate: dispatchProps.onValidate,
  renameAccountError: stateProps.renameAccountError,
  waiting: stateProps.waiting,
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(RenameAccount)
