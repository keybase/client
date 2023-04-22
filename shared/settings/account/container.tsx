import * as Constants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import * as SettingsGen from '../../actions/settings-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {anyWaiting} from '../../constants/waiting'
import AccountSettings from '.'
import {isMobile} from '../../styles'

export default () => {
  const _emails = Container.useSelector(state => state.settings.email.emails)
  const _phones = Container.useSelector(state => state.settings.phoneNumbers.phones)
  const addedEmail = Container.useSelector(state => state.settings.email.addedEmail)
  const addedPhone = Container.useSelector(state => state.settings.phoneNumbers.addedPhone)
  const hasPassword = Container.useSelector(state => !state.settings.password.randomPW)
  const waiting = Container.useSelector(state => anyWaiting(state, Constants.loadSettingsWaitingKey))
  const dispatch = Container.useDispatch()
  const _onClearSupersededPhoneNumber = phone => {
    dispatch(SettingsGen.createEditPhone({delete: true, phone}))
  }
  const onAddEmail = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddEmail']}))
  }
  const onAddPhone = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']}))
  }
  const onBack = isMobile
    ? () => {
        dispatch(RouteTreeGen.createNavigateUp())
      }
    : undefined
  const onClearAddedEmail = () => {
    dispatch(SettingsGen.createClearAddedEmail())
  }
  const onClearAddedPhone = () => {
    dispatch(SettingsGen.createClearAddedPhone())
  }
  const onDeleteAccount = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['deleteConfirm']}))
  }
  const onReload = () => {
    dispatch(SettingsGen.createLoadSettings())
    dispatch(SettingsGen.createLoadRememberPassword())
    dispatch(SettingsGen.createLoadHasRandomPw())
  }
  const onSetPassword = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [Constants.passwordTab]}))
  }
  const onStartPhoneConversation = () => {
    dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [Constants.chatTab, {props: {namespace: 'chat2'}, selected: 'chatNewChat'}],
      })
    )
    dispatch(SettingsGen.createClearAddedPhone())
  }
  const supersededPhoneNumber = _phones && [..._phones.values()].find(p => p.superseded)
  const supersededKey = supersededPhoneNumber && supersededPhoneNumber.e164
  const props = {
    addedEmail: addedEmail,
    addedPhone: addedPhone,
    contactKeys: [...(_emails ? _emails.keys() : []), ...(_phones ? _phones.keys() : [])],
    hasPassword: hasPassword,
    moreThanOneEmail: _emails ? _emails.size > 1 : false,
    onAddEmail,
    onAddPhone,
    onBack,
    onClearAddedEmail,
    onClearAddedPhone,
    onClearSupersededPhoneNumber: () => supersededKey && _onClearSupersededPhoneNumber(supersededKey),
    onDeleteAccount,
    onReload,
    onSetPassword,
    onStartPhoneConversation,
    supersededPhoneNumber: supersededPhoneNumber ? supersededPhoneNumber.displayNumber : undefined,
    tooManyEmails: !!_emails && _emails.size >= 10, // If you change this, also change in keybase/config/prod/email.iced
    tooManyPhones: !!_phones && _phones.size >= 10, // If you change this, also change in keybase/config/prod/phone_numbers.iced
    waiting: waiting,
  }
  return <AccountSettings {...props} />
}
