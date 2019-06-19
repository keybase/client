import * as Constants from '../../constants/settings'
import * as Types from '../../constants/types/settings'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as I from 'immutable'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Bootstrapable from '../../util/bootstrapable'
import {connect, compose, TypedState, TypedDispatch} from '../../util/container'
import AccountSettings from '.'
import {isMobile} from '../../styles'

type OwnProps = {}
const mapStateToProps = (state: TypedState, o: OwnProps) => ({
  _emails: state.settings.email.emails,
  _phones: state.settings.phone.phones,
  bootstrapDone: state.settings.email.emails !== null && state.settings.phone.phones !== null,
  hasPassword: !state.settings.password.randomPW,
})

const mapDispatchToProps = (dispatch: TypedDispatch) => ({
  onAddEmail: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['addEmail']})),
  onAddPhone: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['addPhone']})),
  onBack: isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
  onBootstrap: () => {
    dispatch(SettingsGen.createLoadSettings())
    dispatch(SettingsGen.createLoadRememberPassword())
    dispatch(SettingsGen.createLoadHasRandomPw())
  },
  onDeleteAccount: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deleteConfirm']})),
  onSetPassword: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: isMobile ? [Constants.passwordTab] : ['changePassword']})
    ),
})
export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    (stateProps, dispatchProps, o) => {
      if (!stateProps.bootstrapDone) {
        return {
          bootstrapDone: false,
          onBootstrap: dispatchProps.onBootstrap,
        }
      }
      return {
        bootstrapDone: true,
        originalProps: {
          ...dispatchProps,
          contactKeys: I.List([...stateProps._emails.keys(), ...stateProps._phones.keys()]),
          hasPassword: stateProps.hasPassword,
          title: 'Account',
        },
      }
    }
  ),
  Bootstrapable
)(AccountSettings)
