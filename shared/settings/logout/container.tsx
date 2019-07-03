import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import HiddenString from '../../util/hidden-string'
import LogOut from '.'

type OwnProps = {}

const mapStateToProps = state => ({
  checkPasswordIsCorrect: state.settings.checkPasswordIsCorrect,
  hasRandomPW: state.settings.password.randomPW,
  waitingForResponse: state.settings.waitingForResponse,
})

const mapDispatchToProps = dispatch => ({
  onBootstrap: () => dispatch(SettingsGen.createLoadHasRandomPw()),
  onCancel: () => {
    dispatch(SettingsGen.createLoadedCheckPassword({checkPasswordIsCorrect: null}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onCheckPassword: password => {
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
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
})

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.safeSubmitPerMount(['onLogout'])
)(Kb.HeaderOrPopup(LogOut))
