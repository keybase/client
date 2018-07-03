// @flow
import {connect, type TypedState} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import HiddenString from '../../util/hidden-string'
import {Wrapper as LinkExisting} from '.'

const mapStateToProps = (state: TypedState) => ({
  keyError: state.wallets.secretKeyError,
  nameError: state.wallets.accountNameError,
  nameValidationState: state.wallets.accountNameValidationState,
  secretKeyValidationState: state.wallets.secretKeyValidationState,
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onCancel: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(navigateUp())
  },
  onCheckName: (name: string) => {
    dispatch(WalletsGen.createValidateAccountName({name}))
  },
  onCheckKey: (key: string) => {
    dispatch(
      WalletsGen.createValidateSecretKey({
        secretKey: new HiddenString(key),
      })
    )
  },
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  onDone: (sk: string, name: string) => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(WalletsGen.createLinkExistingAccount({name, secretKey: new HiddenString(sk)}))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(LinkExisting)
