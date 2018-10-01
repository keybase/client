// @flow
import {capitalize} from 'lodash-es'
import {connect, compose, withStateHandlers, type TypedState} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {anyWaiting} from '../../constants/waiting'
import CreateAccount from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  createNewAccountError: state.wallets.createNewAccountError,
  error: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  waiting: anyWaiting(state, Constants.createNewAccountWaitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _onCreateAccount: (name: string) =>
    dispatch(WalletsGen.createCreateNewAccount({name, showOnCreation: routeProps.get('showOnCreation')})),
  _onDone: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
  onCancel: () => dispatch(navigateUp()),
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  ...stateProps,
  ...dispatchProps,
  error: capitalize(stateProps.error),
  onCreateAccount: () => dispatchProps._onCreateAccount(ownProps.name),
  onDone: () => dispatchProps._onDone(ownProps.name),
  onBack: ownProps.routeProps.get('backButton') ? dispatchProps.onCancel : undefined,
})

export default compose(
  withStateHandlers(
    {name: ''},
    {
      onNameChange: () => name => ({name}),
    }
  ),
  connect(mapStateToProps, mapDispatchToProps, mergeProps)
)(CreateAccount)
