import * as Container from '../../util/container'
import * as Constants from '../../constants/settings'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'
import LogOut from '.'

type OwnProps = {}

export default Container.connect(
  state => ({
    checkPasswordIsCorrect: state.settings.checkPasswordIsCorrect,
    hasRandomPW: state.settings.password.randomPW,
    waitingForResponse: Container.anyWaiting(state, Constants.settingsWaitingKey),
  }),
  dispatch => ({
    onBootstrap: () => dispatch(SettingsGen.createLoadHasRandomPw()),
    onCancel: () => {
      dispatch(SettingsGen.createLoadedCheckPassword({checkPasswordIsCorrect: null}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onCheckPassword: (password: string) => {
      if (password) {
        dispatch(SettingsGen.createCheckPassword({password: new HiddenString(password)}))
      }
    },
    onLogout: () => {
      dispatch(ConfigGen.createLogout())
      dispatch(SettingsGen.createLoadedCheckPassword({checkPasswordIsCorrect: null}))
    },
    onSavePassword: (password: string, passwordConfirm: string) => {
      dispatch(SettingsGen.createOnChangeNewPassword({password: new HiddenString(password)}))
      dispatch(SettingsGen.createOnChangeNewPasswordConfirm({password: new HiddenString(passwordConfirm)}))
      dispatch(SettingsGen.createOnSubmitNewPassword({thenSignOut: true}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
  })
)(Container.safeSubmitPerMount(['onLogout'])(LogOut))
