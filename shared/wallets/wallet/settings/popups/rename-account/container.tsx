import {capitalize} from 'lodash-es'
import * as Container from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import {anyWaiting} from '../../../../../constants/waiting'
import RenameAccount from '.'

type OwnProps = Container.RouteProps<{accountID: Types.AccountID}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const accountID = Container.getRouteProps(ownProps, 'accountID', Types.noAccountID)
    const selectedAccount = Constants.getAccount(state, accountID)
    return {
      accountID,
      error: state.wallets.accountNameError,
      initialName: selectedAccount.name,
      nameValidationState: state.wallets.accountNameValidationState,
      renameAccountError: state.wallets.createNewAccountError,
      waiting: anyWaiting(
        state,
        Constants.changeAccountNameWaitingKey,
        Constants.validateAccountNameWaitingKey
      ),
    }
  },
  dispatch => ({
    _onChangeAccountName: (accountID: Types.AccountID, name: string) =>
      dispatch(WalletsGen.createChangeAccountName({accountID, name})),
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
    onDone: (name: string) => {
      dispatch(WalletsGen.createValidateAccountName({name}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    error: capitalize(stateProps.error),
    initialName: stateProps.initialName,
    nameValidationState: stateProps.nameValidationState,
    onCancel: dispatchProps.onCancel,
    onChangeAccountName: (name: string) => dispatchProps._onChangeAccountName(stateProps.accountID, name),
    onClearErrors: dispatchProps.onClearErrors,
    onDone: dispatchProps.onDone,
    renameAccountError: stateProps.renameAccountError,
    waiting: stateProps.waiting,
  })
)(RenameAccount)
