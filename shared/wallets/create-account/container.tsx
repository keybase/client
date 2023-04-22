import capitalize from 'lodash/capitalize'
import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import CreateAccount from '.'

type OwnProps = Container.RouteProps<'createNewAccount'>

export default (ownProps: OwnProps) => {
  const createNewAccountError = Container.useSelector(state => state.wallets.createNewAccountError)
  const error = Container.useSelector(state => state.wallets.accountNameError)
  const nameValidationState = Container.useSelector(state => state.wallets.accountNameValidationState)
  const waiting = Container.useSelector(state =>
    anyWaiting(state, Constants.createNewAccountWaitingKey, Constants.validateAccountNameWaitingKey)
  )

  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClearErrors = () => {
    dispatch(WalletsGen.createClearErrors())
  }
  const onCreateAccount = (name: string) => {
    dispatch(
      WalletsGen.createCreateNewAccount({
        name,
        setBuildingTo: ownProps.route.params?.fromSendForm,
        showOnCreation: ownProps.route.params?.showOnCreation,
      })
    )
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onDone = (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  }
  const props = {
    createNewAccountError,
    error: capitalize(error),
    nameValidationState,
    onCancel: onCancel,
    onClearErrors: onClearErrors,
    onCreateAccount: onCreateAccount,
    onDone: onDone,
    waiting,
  }
  return <CreateAccount {...props} />
}
