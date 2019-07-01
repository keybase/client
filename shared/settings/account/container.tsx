import * as Constants from '../../constants/settings'
import * as I from 'immutable'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect, TypedState, TypedDispatch} from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import AccountSettings, {Props} from '.'
import {isMobile} from '../../styles'

type OwnProps = {}
const mapStateToProps = (state: TypedState, o: OwnProps) => ({
  _emails: state.settings.email.emails,
  _phones: state.settings.phoneNumbers.phones,
  addedEmail: state.settings.email.addedEmail,
  bootstrapDone: state.settings.email.emails !== null && state.settings.phoneNumbers.phones !== null,
  hasPassword: !state.settings.password.randomPW,
  waiting: anyWaiting(state, Constants.loadSettingsWaitingKey),
})

const mapDispatchToProps = (dispatch: TypedDispatch) => ({
  onAddEmail: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddEmail']})),
  onAddPhone: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']})),
  onBack: isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
  onClearAddedEmail: () => dispatch(SettingsGen.createClearAddedEmail()),
  onDeleteAccount: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deleteConfirm']})),
  onManageContacts: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsManageContacts']})),
  onReload: () => {
    dispatch(SettingsGen.createLoadSettings())
    dispatch(SettingsGen.createLoadRememberPassword())
    dispatch(SettingsGen.createLoadHasRandomPw())
  },
  onSetPassword: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: isMobile ? [Constants.passwordTab] : ['changePassword']})
    ),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, o): Props => ({
    ...dispatchProps,
    addedEmail: stateProps.addedEmail,
    contactKeys: I.List([
      ...(stateProps._emails ? stateProps._emails.keys() : []),
      ...(stateProps._phones ? stateProps._phones.keys() : []),
    ]),
    hasPassword: stateProps.hasPassword,
    title: 'Account',
    waiting: stateProps.waiting,
  })
)(AccountSettings)
