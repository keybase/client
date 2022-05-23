import * as Container from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/wallets'
import {anyWaiting} from '../../constants/waiting'
import HiddenString from '../../util/hidden-string'
import {Wrapper as LinkExisting} from '.'

type OwnProps = Container.RouteProps<'linkExisting'>

export default Container.connect(
  state => ({
    keyError: state.wallets.secretKeyError,
    linkExistingAccountError: state.wallets.linkExistingAccountError,
    nameError: state.wallets.accountNameError,
    nameValidationState: state.wallets.accountNameValidationState,
    secretKeyValidationState: state.wallets.secretKeyValidationState,
    waiting: anyWaiting(
      state,
      Constants.linkExistingWaitingKey,
      Constants.validateAccountNameWaitingKey,
      Constants.validateSecretKeyWaitingKey
    ),
  }),
  (dispatch, ownProps: OwnProps) => ({
    fromSendForm: ownProps.route.params?.fromSendForm ?? undefined,
    onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
    onCheckKey: (key: string) => {
      dispatch(
        WalletsGen.createValidateSecretKey({
          secretKey: new HiddenString(key),
        })
      )
    },
    onCheckName: (name: string) => {
      dispatch(WalletsGen.createValidateAccountName({name}))
    },
    onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
    onDone: (sk: string, name: string) => {
      dispatch(
        WalletsGen.createLinkExistingAccount({
          name,
          secretKey: new HiddenString(sk),
          setBuildingTo: ownProps.route.params?.fromSendForm ?? undefined,
          showOnCreation: ownProps.route.params?.showOnCreation ?? undefined,
        })
      )

      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    keyError: stateProps.keyError,
    linkExistingAccountError: stateProps.linkExistingAccountError,
    nameError: stateProps.nameError,
    nameValidationState: stateProps.nameValidationState,
    onCancel: dispatchProps.onCancel,
    onCheckKey: dispatchProps.onCheckKey,
    onCheckName: dispatchProps.onCheckName,
    onClearErrors: dispatchProps.onClearErrors,
    onDone: dispatchProps.onDone,
    secretKeyValidationState: stateProps.secretKeyValidationState,
    waiting: stateProps.waiting,
  })
)(LinkExisting)
