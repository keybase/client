// @flow
import {capitalize} from 'lodash-es'
import {connect, type RouteProps} from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {anyWaiting} from '../../constants/waiting'
import CreateAccount from '.'

type OwnProps = RouteProps<{backButton?: boolean, fromSendForm?: boolean, showOnCreation?: boolean}, {}>

const mapStateToProps = (state, {routeProps}: OwnProps) => ({
  createNewAccountError: state.wallets.createNewAccountError,
  error: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  waiting: anyWaiting(state, Constants.createNewAccountWaitingKey, Constants.validateAccountNameWaitingKey),
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps, fromSendForm}) => ({
  onCancel: () => navigateUp && dispatch(navigateUp()),
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  onCreateAccount: (name: string) =>
    dispatch(
      WalletsGen.createCreateNewAccount({
        name,
        setBuildingTo: routeProps.get('fromSendForm'),
        showOnCreation: routeProps.get('showOnCreation'),
      })
    ),
  onDone: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  error: capitalize(stateProps.error),
  onBack: ownProps.routeProps.get('backButton') ? dispatchProps.onCancel : undefined,
  onCancel: dispatchProps.onCancel,
  onClearErrors: dispatchProps.onClearErrors,
  onCreateAccount: dispatchProps.onCreateAccount,
  onDone: dispatchProps.onDone,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(CreateAccount)
