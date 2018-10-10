// @flow
import {connect, type TypedState} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import {anyWaiting} from '../../constants/waiting'
import HiddenString from '../../util/hidden-string'
import {Wrapper as LinkExisting} from '.'

const mapStateToProps = (state: TypedState) => ({
  keyError: state.wallets.secretKeyError,
  linkExistingAccountError: state.wallets.linkExistingAccountError,
  nameError: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  secretKeyValidationState: state.wallets.secretKeyValidationState,
  waiting: anyWaiting(state, Constants.linkExistingWaitingKey),
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps, fromSendForm}) => ({
  onCancel: () => navigateUp && dispatch(navigateUp()),
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
  onDone: (sk: string, name: string) =>
    dispatch(
      WalletsGen.createLinkExistingAccount({
        name,
        secretKey: new HiddenString(sk),
        showOnCreation: !!routeProps && routeProps.get('showOnCreation'),
        setBuildingTo: fromSendForm,
      })
    ),
  fromSendForm,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  keyError: stateProps.keyError,
  linkExistingAccountError: stateProps.linkExistingAccountError,
  nameError: stateProps.nameError,
  nameValidationState: stateProps.nameValidationState,
  secretKeyValidationState: stateProps.secretKeyValidationState,
  waiting: stateProps.waiting,
  onCancel: ownProps.onCancel || dispatchProps.onCancel,
  onCheckKey: dispatchProps.onCheckKey,
  onCheckName: dispatchProps.onCheckName,
  onClearErrors: dispatchProps.onClearErrors,
  onDone: dispatchProps.onDone,
  onBack: ownProps.onBack || (ownProps.routeProps.get('backButton') ? dispatchProps.onCancel : undefined),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(LinkExisting)
