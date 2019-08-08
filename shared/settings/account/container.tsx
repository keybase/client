import * as Constants from '../../constants/settings'
import * as I from 'immutable'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect, TypedState, TypedDispatch} from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import AccountSettings from '.'
import {isMobile} from '../../styles'

type OwnProps = {}
const mapStateToProps = (state: TypedState) => ({
  _emails: state.settings.email.emails,
  _phones: state.settings.phoneNumbers.phones,
  addedEmail: state.settings.email.addedEmail,
  bootstrapDone: state.settings.email.emails !== null && state.settings.phoneNumbers.phones !== null,
  hasPassword: !state.settings.password.randomPW,
  waiting: anyWaiting(state, Constants.loadSettingsWaitingKey),
})

const mapDispatchToProps = (dispatch: TypedDispatch) => ({
  _onClearSupersededPhoneNumber: phone => dispatch(SettingsGen.createEditPhone({delete: true, phone})),
  onAddEmail: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddEmail']})),
  onAddPhone: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']})),
  onBack: isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
  onClearAddedEmail: () => dispatch(SettingsGen.createClearAddedEmail()),
  onDeleteAccount: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['deleteConfirm']})),
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
  (stateProps, dispatchProps, _: OwnProps) => {
    const supersededPhoneNumber = stateProps._phones && stateProps._phones.find(p => p.superseded)
    const supersededKey = supersededPhoneNumber && supersededPhoneNumber.e164
    return {
      ...dispatchProps,
      addedEmail: stateProps.addedEmail,
      contactKeys: I.List([
        ...(stateProps._emails ? stateProps._emails.keys() : []),
        ...(stateProps._phones ? stateProps._phones.keys() : []),
      ]),
      hasPassword: stateProps.hasPassword,
      onClearSupersededPhoneNumber: () =>
        supersededKey && dispatchProps._onClearSupersededPhoneNumber(supersededKey),
      supersededPhoneNumber: supersededPhoneNumber ? supersededPhoneNumber.displayNumber : undefined,
      title: 'Your account',
      tooManyEmails: !!stateProps._emails && stateProps._emails.size >= 10, // If you change this, also change in keybase/config/prod/email.iced
      tooManyPhones: !!stateProps._phones && stateProps._phones.size >= 10, // If you change this, also change in keybase/config/prod/phone_numbers.iced
      waiting: stateProps.waiting,
    }
  }
)(AccountSettings)
