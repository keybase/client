import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/wallets'
import HiddenString from '../../util/hidden-string'
import {Wrapper as LinkExisting} from '.'

type OwnProps = {
  fromSendForm?: boolean
  showOnCreation?: boolean
}

export default (ownProps: OwnProps) => {
  const setBuildingTo = ownProps.fromSendForm
  const showOnCreation = ownProps.showOnCreation
  const keyError = Container.useSelector(state => state.wallets.secretKeyError)
  const linkExistingAccountError = Container.useSelector(state => state.wallets.linkExistingAccountError)
  const nameError = Container.useSelector(state => state.wallets.accountNameError)
  const nameValidationState = Container.useSelector(state => state.wallets.accountNameValidationState)
  const secretKeyValidationState = Container.useSelector(state => state.wallets.secretKeyValidationState)
  const waiting = Container.useAnyWaiting([
    Constants.linkExistingWaitingKey,
    Constants.validateAccountNameWaitingKey,
    Constants.validateSecretKeyWaitingKey,
  ])
  const dispatch = Container.useDispatch()

  const onCancel = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onCheckKey = (key: string) => {
    dispatch(
      WalletsGen.createValidateSecretKey({
        secretKey: new HiddenString(key),
      })
    )
  }
  const onCheckName = (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  }
  const onClearErrors = () => {
    dispatch(WalletsGen.createClearErrors())
  }
  const onDone = (sk: string, name: string) => {
    dispatch(
      WalletsGen.createLinkExistingAccount({
        name,
        secretKey: new HiddenString(sk),
        setBuildingTo,
        showOnCreation,
      })
    )
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const props = {
    keyError: keyError,
    linkExistingAccountError: linkExistingAccountError,
    nameError: nameError,
    nameValidationState: nameValidationState,
    onCancel: onCancel,
    onCheckKey: onCheckKey,
    onCheckName: onCheckName,
    onClearErrors: onClearErrors,
    onDone: onDone,
    secretKeyValidationState: secretKeyValidationState,
    waiting: waiting,
  }
  return <LinkExisting {...props} />
}
