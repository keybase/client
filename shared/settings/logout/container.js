// @flow
import {HeaderOrPopup} from '../../common-adapters'
import {connect, type RouteProps} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'
import LogOut from '.'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state, {routeProps}) => ({
  hasRandomPW: state.settings.passphrase.randomPW,
  testPassphraseIsCorrect: state.settings.testPassphraseIsCorrect,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  onCancel: () => dispatch(navigateUp()),
  onLogout: () => dispatch(ConfigGen.createLogout()),
  onSavePassphrase: (passphrase: string, passphraseConfirm: string) => {
    dispatch(SettingsGen.createOnChangeNewPassphrase({passphrase: new HiddenString(passphrase)}))
    dispatch(
      SettingsGen.createOnChangeNewPassphraseConfirm({passphrase: new HiddenString(passphraseConfirm)})
    )
    dispatch(SettingsGen.createOnSubmitNewPassphrase())
  },
  onTestPassphrase: passphrase =>
    dispatch(SettingsGen.createTestPassphrase({passphrase: new HiddenString(passphrase)})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  heading: stateProps.hasRandomPW
    ? "You don't have a passphrase set -- you should set one before logging out, so that you can log in again later."
    : "Would you like to make sure that you know your passphrase before logging out? You'll need it to log back in.",
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(HeaderOrPopup(LogOut))
