// @flow
import {HeaderOrPopup} from '../../common-adapters'
import {connect, type RouteProps} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'
import LogOut from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state, {routeProps}) => ({
  checkPassphraseIsCorrect: state.settings.checkPassphraseIsCorrect,
  hasRandomPW: state.settings.passphrase.randomPW,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onCheckPassphrase: passphrase =>
    dispatch(SettingsGen.createCheckPassphrase({passphrase: new HiddenString(passphrase)})),
  onLogout: () => dispatch(ConfigGen.createLogout()),
  onSavePassphrase: (passphrase: string, passphraseConfirm: string) => {
    dispatch(SettingsGen.createOnChangeNewPassphrase({passphrase: new HiddenString(passphrase)}))
    dispatch(
      SettingsGen.createOnChangeNewPassphraseConfirm({passphrase: new HiddenString(passphraseConfirm)})
    )
    dispatch(SettingsGen.createOnSubmitNewPassphrase())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(HeaderOrPopup(LogOut))
