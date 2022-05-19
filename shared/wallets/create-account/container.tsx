import capitalize from 'lodash/capitalize'
import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import CreateAccount from '.'

type OwnProps = Container.RouteProps<'createNewAccount'>

export default Container.connect(
  state => ({
    createNewAccountError: state.wallets.createNewAccountError,
    error: state.wallets.accountNameError,
    nameValidationState: state.wallets.accountNameValidationState,
    waiting: anyWaiting(state, Constants.createNewAccountWaitingKey, Constants.validateAccountNameWaitingKey),
  }),
  (dispatch, ownProps: OwnProps) => ({
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
    onCreateAccount: (name: string) => {
      dispatch(
        WalletsGen.createCreateNewAccount({
          name,
          setBuildingTo: ownProps.route.params?.fromSendForm,
          showOnCreation: ownProps.route.params?.showOnCreation,
        })
      )
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onDone: (name: string) => {
      dispatch(WalletsGen.createValidateAccountName({name}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    error: capitalize(stateProps.error),
    onCancel: dispatchProps.onCancel,
    onClearErrors: dispatchProps.onClearErrors,
    onCreateAccount: dispatchProps.onCreateAccount,
    onDone: dispatchProps.onDone,
  })
)(CreateAccount)
