// @flow
import * as Kb from '../../common-adapters'
import {connect} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'
import LogOut from '.'

type OwnProps = {||}

const mapStateToProps = state => ({
  checkPassphraseIsCorrect: state.settings.checkPassphraseIsCorrect,
  hasRandomPW: state.settings.passphrase.randomPW,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(SettingsGen.createLoadedCheckPassphrase({checkPassphraseIsCorrect: null}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onCheckPassphrase: passphrase => {
    if (passphrase) {
      dispatch(SettingsGen.createCheckPassphrase({passphrase: new HiddenString(passphrase)}))
    }
  },
  onLogout: () => {
    dispatch(ConfigGen.createLogout())
    dispatch(SettingsGen.createLoadedCheckPassphrase({checkPassphraseIsCorrect: null}))
  },
  onSavePassphrase: (passphrase: string, passphraseConfirm: string) => {
    dispatch(SettingsGen.createOnChangeNewPassphrase({passphrase: new HiddenString(passphrase)}))
    dispatch(
      SettingsGen.createOnChangeNewPassphraseConfirm({passphrase: new HiddenString(passphraseConfirm)})
    )
    dispatch(SettingsGen.createOnSubmitNewPassphrase({thenSignOut: true}))
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
)(Kb.HeaderOrPopup(LogOut))
