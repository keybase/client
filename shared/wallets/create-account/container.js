// @flow
import {capitalize} from 'lodash-es'
import {connect, compose, withStateHandlers} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {anyWaiting} from '../../constants/waiting'
import CreateAccount from '.'

const mapStateToProps = (state, {routeProps}) => ({
  createNewAccountError: state.wallets.createNewAccountError,
  error: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  waiting: anyWaiting(state, Constants.createNewAccountWaitingKey),
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps, fromSendForm}) => ({
  _onCreateAccount: (name: string) =>
    dispatch(
      WalletsGen.createCreateNewAccount({
        name,
        showOnCreation: !!routeProps && routeProps.get('showOnCreation'),
        setBuildingTo: fromSendForm,
      })
    ),
  _onDone: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
  onCancel: () => navigateUp && dispatch(navigateUp()),
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  name: ownProps.name,
  error: capitalize(stateProps.error),
  onNameChange: ownProps.onNameChange,
  onClearErrors: dispatchProps.onClearErrors,
  onCreateAccount: () => dispatchProps._onCreateAccount(ownProps.name),
  onDone: () => dispatchProps._onDone(ownProps.name),
  onCancel: ownProps.onCancel || dispatchProps.onCancel,
  onBack: ownProps.onBack || (ownProps.routeProps.get('backButton') ? dispatchProps.onCancel : undefined),
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
)(CreateAccount)
