// @flow
import {capitalize} from 'lodash-es'
import {connect, type RouteProps} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import {anyWaiting} from '../../../../../constants/waiting'
import RenameAccount from '.'

type OwnProps = RouteProps<{accountID: Types.AccountID}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
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
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onChangeAccountName: (accountID: Types.AccountID, name: string) =>
    dispatch(WalletsGen.createChangeAccountName({accountID, name})),
  onCancel: () => dispatch(navigateUp()),
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  onDone: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  error: capitalize(stateProps.error),
  initialName: stateProps.initialName,
  nameValidationState: stateProps.nameValidationState,
  onCancel: dispatchProps.onCancel,
  onChangeAccountName: name => dispatchProps._onChangeAccountName(stateProps.accountID, name),
  onClearErrors: dispatchProps.onClearErrors,
  onDone: dispatchProps.onDone,
  renameAccountError: stateProps.renameAccountError,
  waiting: stateProps.waiting,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(RenameAccount)
