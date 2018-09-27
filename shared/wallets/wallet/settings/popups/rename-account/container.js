// @flow
import {capitalize} from 'lodash-es'
import {connect, compose, withStateHandlers, type TypedState} from '../../../../../util/container'
import * as Constants from '../../../../../constants/wallets'
import * as Types from '../../../../../constants/types/wallets'
import * as WalletsGen from '../../../../../actions/wallets-gen'
import {anyWaiting} from '../../../../../constants/waiting'
import RenameAccount from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  accountID: routeProps.get('accountID'),
  error: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  renameAccountError: state.wallets.createNewAccountError,
  waiting: anyWaiting(state, Constants.changeAccountNameWaitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onChangeAccountName: (accountID: Types.AccountID, name: string) =>
    dispatch(WalletsGen.createChangeAccountName({accountID, name})),
  _onDone: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
  onCancel: () => dispatch(navigateUp()),
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  error: capitalize(stateProps.error),
  onCancel: dispatchProps.onCancel,
  onChangeAccountName: () => dispatchProps._onChangeAccountName(stateProps.accountID, ownProps.name),
  onClearErrors: dispatchProps.onClearErrors,
  onDone: () => dispatchProps._onDone(ownProps.name),
})

export default compose(
  withStateHandlers(
    {name: ''},
    {
      onNameChange: () => name => ({name}),
    }
  ),
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(RenameAccount)
