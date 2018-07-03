// @flow
import {connect, type TypedState} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as Constants from '../../constants/wallets'
import {anyWaiting} from '../../constants/waiting'
import HiddenString from '../../util/hidden-string'
import {Wrapper as LinkExisting} from '.'

const mapStateToProps = (state: TypedState) => ({
  keyError: state.wallets.secretKeyError,
  nameError: state.wallets.accountNameError,
  waitingNameValidation: anyWaiting(state, Constants.waitingKeys.linkExistingValidateName),
  waitingSecretKeyValidation: anyWaiting(state, Constants.waitingKeys.linkExistingValidateSK),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onCancel: () => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(navigateUp())
  },
  onClearErrors: () => dispatch(WalletsGen.createClearErrors()),
  onDone: (sk: string, name: string) => {
    dispatch(WalletsGen.createClearErrors())
    dispatch(WalletsGen.createLinkExistingAccount({name, secretKey: new HiddenString(sk)}))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(LinkExisting)
