import * as Constants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import AccountSettings from '.'
import {isMobile} from '../../styles'

type OwnProps = {}

export default Container.connect(
  state => ({
    _emails: state.settings.email.emails,
    _phones: state.settings.phoneNumbers.phones,
    addedEmail: state.settings.email.addedEmail,
    addedPhone: state.settings.phoneNumbers.addedPhone,
    bootstrapDone: state.settings.email.emails !== null && state.settings.phoneNumbers.phones !== null,
    hasPassword: !state.settings.password.randomPW,
    waiting: anyWaiting(state, Constants.loadSettingsWaitingKey),
  }),
  dispatch => ({
    _onClearSupersededPhoneNumber: phone => dispatch(SettingsGen.createEditPhone({delete: true, phone})),
    onAddEmail: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddEmail']})),
    onAddPhone: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']})),
    onBack: isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
    onClearAddedEmail: () => dispatch(SettingsGen.createClearAddedEmail()),
    onClearAddedPhone: () => dispatch(SettingsGen.createClearAddedPhone()),
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
    onStartPhoneConversation: () => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}))
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [Constants.chatTab, {props: {namespace: 'chat2'}, selected: 'chatNewChat'}],
        })
      )
      dispatch(SettingsGen.createClearAddedPhone())
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const supersededPhoneNumber =
      stateProps._phones && [...stateProps._phones.values()].find(p => p.superseded)
    const supersededKey = supersededPhoneNumber && supersededPhoneNumber.e164
    return {
      ...dispatchProps,
      addedEmail: stateProps.addedEmail,
      addedPhone: stateProps.addedPhone,
      contactKeys: [
        ...(stateProps._emails ? stateProps._emails.keys() : []),
        ...(stateProps._phones ? stateProps._phones.keys() : []),
      ],
      hasPassword: stateProps.hasPassword,
      moreThanOneEmail: stateProps._emails ? stateProps._emails.size > 1 : false,
      onClearSupersededPhoneNumber: () =>
        supersededKey && dispatchProps._onClearSupersededPhoneNumber(supersededKey),
      supersededPhoneNumber: supersededPhoneNumber ? supersededPhoneNumber.displayNumber : undefined,
      tooManyEmails: !!stateProps._emails && stateProps._emails.size >= 10, // If you change this, also change in keybase/config/prod/email.iced
      tooManyPhones: !!stateProps._phones && stateProps._phones.size >= 10, // If you change this, also change in keybase/config/prod/phone_numbers.iced
      waiting: stateProps.waiting,
    }
  }
)(AccountSettings)
