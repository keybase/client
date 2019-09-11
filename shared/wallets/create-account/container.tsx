import {capitalize} from 'lodash-es'
import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import CreateAccount from '.'

type OwnProps = Container.RouteProps<{fromSendForm?: boolean; showOnCreation?: boolean}>

const mapStateToProps = state => ({
  createNewAccountError: state.wallets.createNewAccountError,
  error: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  waiting: anyWaiting(state, Constants.createNewAccountWaitingKey, Constants.validateAccountNameWaitingKey),
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  onCreateAccount: (name: string) => {
    dispatch(
      WalletsGen.createCreateNewAccount({
        name,
        setBuildingTo: Container.getRouteProps(ownProps, 'fromSendForm', undefined),
        showOnCreation: Container.getRouteProps(ownProps, 'showOnCreation', undefined),
      })
    )
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onDone: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  ...stateProps,
  error: capitalize(stateProps.error),
  onCancel: dispatchProps.onCancel,
  onClearErrors: dispatchProps.onClearErrors,
  onCreateAccount: dispatchProps.onCreateAccount,
  onDone: dispatchProps.onDone,
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(CreateAccount)
