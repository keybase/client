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

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onCancel: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(navigateUp())
  },
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
    dispatch(WalletsGen.createClearErrors())
    dispatch(WalletsGen.createLinkExistingAccount({name, secretKey: new HiddenString(sk)}))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(LinkExisting)
