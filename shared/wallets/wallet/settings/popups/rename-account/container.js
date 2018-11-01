// @flow
import {capitalize} from 'lodash-es'
import {connect} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import {anyWaiting} from '../../../../../constants/waiting'
import RenameAccount from '.'

const mapStateToProps = (state, {routeProps}) => {
  const accountID = routeProps.get('accountID')
  const selectedAccount = Constants.getAccount(state, accountID)
  return {
    accountID,
    error: state.wallets.accountNameError,
    nameValidationState: state.wallets.accountNameValidationState,
    renameAccountError: state.wallets.createNewAccountError,
    waiting: anyWaiting(state, Constants.changeAccountNameWaitingKey),
    initialName: selectedAccount.name,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onChangeAccountName: (accountID: Types.AccountID, name: string) =>
    dispatch(WalletsGen.createChangeAccountName({accountID, name})),
  onCancel: () => dispatch(navigateUp()),
  onDone: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  error: capitalize(stateProps.error),
  onCancel: dispatchProps.onCancel,
  onChangeAccountName: name => dispatchProps._onChangeAccountName(stateProps.accountID, name),
  onClearErrors: dispatchProps.onClearErrors,
  onDone: dispatchProps.onDone,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(RenameAccount)
