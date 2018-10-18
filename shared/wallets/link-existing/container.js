// @flow
import {connect} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import {anyWaiting} from '../../constants/waiting'
import HiddenString from '../../util/hidden-string'
import {Wrapper as LinkExisting} from '.'

const mapStateToProps = state => ({
  keyError: state.wallets.secretKeyError,
  linkExistingAccountError: state.wallets.linkExistingAccountError,
  nameError: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  secretKeyValidationState: state.wallets.secretKeyValidationState,
  waiting: anyWaiting(state, Constants.linkExistingWaitingKey),
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps, fromSendRequestForm}) => ({
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
        showOnCreation: routeProps.get('showOnCreation'),
        setBuildingTo: routeProps.get('fromSendRequestForm'),
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  keyError: stateProps.keyError,
  linkExistingAccountError: stateProps.linkExistingAccountError,
  nameError: stateProps.nameError,
  nameValidationState: stateProps.nameValidationState,
  secretKeyValidationState: stateProps.secretKeyValidationState,
  waiting: stateProps.waiting,
  onCancel: dispatchProps.onCancel,
  onCheckKey: dispatchProps.onCheckKey,
  onCheckName: dispatchProps.onCheckName,
  onClearErrors: dispatchProps.onClearErrors,
  onDone: dispatchProps.onDone,
  onBack: ownProps.routeProps.get('fromSendRequestForm') ? dispatchProps.onCancel : undefined,
  stacked: !!ownProps.routeProps.get('fromSendRequestForm'),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(LinkExisting)
