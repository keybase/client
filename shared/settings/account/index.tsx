import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import EmailPhoneRow from './email-phone-row'
import {isMobile} from '@/styles'

const Container = () => {
  const _emails = C.useSettingsEmailState(s => s.emails)
  const _phones = C.useSettingsPhoneState(s => s.phones)
  const addedEmail = C.useSettingsEmailState(s => s.addedEmail)
  const addedPhone = C.useSettingsPhoneState(s => s.addedPhone)
  const editPhone = C.useSettingsPhoneState(s => s.dispatch.editPhone)
  const clearAddedPhone = C.useSettingsPhoneState(s => s.dispatch.clearAddedPhone)
  const hasPassword = C.useSettingsPasswordState(s => !s.randomPW)
  const waiting = C.Waiting.useAnyWaiting(Constants.loadSettingsWaitingKey)
  const _onClearSupersededPhoneNumber = (phone: string) => {
    editPhone(phone, true)
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onAddEmail = () => {
    navigateAppend('settingsAddEmail')
  }
  const onAddPhone = () => {
    navigateAppend('settingsAddPhone')
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = isMobile
    ? () => {
        navigateUp()
      }
    : undefined

  const resetAddedEmail = C.useSettingsEmailState(s => s.dispatch.resetAddedEmail)
  const onClearAddedEmail = resetAddedEmail
  const onClearAddedPhone = clearAddedPhone
  const onDeleteAccount = () => {
    navigateAppend('deleteConfirm')
  }
  const loadSettings = C.useSettingsState(s => s.dispatch.loadSettings)
  const loadRememberPassword = C.useSettingsPasswordState(s => s.dispatch.loadRememberPassword)
  const loadHasRandomPw = C.useSettingsPasswordState(s => s.dispatch.loadHasRandomPw)

  const onReload = () => {
    loadSettings()
    loadRememberPassword()
    loadHasRandomPw()
  }
  const onSetPassword = () => {
    navigateAppend(C.Settings.settingsPasswordTab)
  }
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onStartPhoneConversation = () => {
    switchTab(C.Tabs.chatTab)
    navigateAppend({props: {namespace: 'chat2'}, selected: 'chatNewChat'})
    clearAddedPhone()
  }
  const supersededPhoneNumber = _phones && [..._phones.values()].find(p => p.superseded)
  const supersededKey = supersededPhoneNumber?.e164
  const props = {
    addedEmail: addedEmail,
    addedPhone: addedPhone,
    contactKeys: [..._emails.keys(), ...(_phones ? _phones.keys() : [])],
    hasPassword: hasPassword,
    moreThanOneEmail: _emails.size > 1,
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
    tooManyEmails: _emails.size >= 10, // If you change this, also change in keybase/config/prod/email.iced
    tooManyPhones: !!_phones && _phones.size >= 10, // If you change this, also change in keybase/config/prod/phone_numbers.iced
    waiting: waiting,
  }
  return <AccountSettings {...props} />
}

export type Props = {
  addedEmail?: string
  addedPhone: boolean
  contactKeys: Array<string>
  hasPassword: boolean
  onClearSupersededPhoneNumber: () => void
  onBack?: () => void
  onAddEmail: () => void
  onAddPhone: () => void
  onClearAddedEmail: () => void
  onClearAddedPhone: () => void
  onDeleteAccount: () => void
  onSetPassword: () => void
  onStartPhoneConversation: () => void
  onReload: () => void
  supersededPhoneNumber?: string
  tooManyEmails: boolean
  tooManyPhones: boolean
  moreThanOneEmail: boolean
  waiting: boolean
}

export const SettingsSection = ({children}: {children: React.ReactNode}) => (
  <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.section}>
    {children}
  </Kb.Box2>
)

type AddButtonProps = {
  disabled: boolean
  kind: 'phone number' | 'email'
  onClick: () => void
}
const AddButton = (props: AddButtonProps) => (
  <Kb.Button
    mode="Secondary"
    onClick={props.onClick}
    label={`Add ${props.kind}`}
    small={true}
    disabled={props.disabled}
    className="tooltip-top-right"
    tooltip={props.disabled ? `You're already at the maximum ${props.kind}s` : undefined}
  />
)

const EmailPhone = (props: Props) => (
  <SettingsSection>
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      <Kb.Box2 alignItems="center" direction="horizontal" gap="tiny" fullWidth={true}>
        <Kb.Text type="Header">Email & phone</Kb.Text>
        {props.waiting && <Kb.ProgressIndicator style={styles.progress} />}
      </Kb.Box2>
      <Kb.Text type="BodySmall">
        Secures your account by letting us send important notifications, and allows friends and teammates to
        find you by phone number or email.{' '}
        <Kb.Text type="BodySmallPrimaryLink" onClickURL="https://keybase.io/docs/chat/phones-and-emails">
          Read more{' '}
          <Kb.Icon
            type="iconfont-open-browser"
            sizeType="Tiny"
            boxStyle={styles.displayInline}
            color={Kb.Styles.globalColors.blueDark}
          />
        </Kb.Text>
      </Kb.Text>
    </Kb.Box2>
    {!!props.contactKeys.length && (
      <Kb.Box2 direction="vertical" style={styles.contactRows} fullWidth={true}>
        {props.contactKeys.map(ck => (
          <EmailPhoneRow contactKey={ck} key={ck} />
        ))}
      </Kb.Box2>
    )}
    <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
      <AddButton onClick={props.onAddEmail} kind="email" disabled={props.tooManyEmails} />
      <AddButton onClick={props.onAddPhone} kind="phone number" disabled={props.tooManyPhones} />
    </Kb.ButtonBar>
  </SettingsSection>
)

const Password = (props: Props) => {
  let passwordLabel: string
  if (props.hasPassword) {
    passwordLabel = Kb.Styles.isMobile ? 'Change' : 'Change password'
  } else {
    passwordLabel = 'Set a password'
  }
  return (
    <SettingsSection>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
        <Kb.Text type="Header">Password</Kb.Text>
        <Kb.Text type="BodySmall">Allows you to sign out and sign back in.</Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" alignItems="flex-start" fullWidth={true}>
        {props.hasPassword && (
          <Kb.Text type="BodySemibold" style={styles.password}>
            ********************
          </Kb.Text>
        )}
        <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
          <Kb.Button mode="Secondary" onClick={props.onSetPassword} label={passwordLabel} small={true} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </SettingsSection>
  )
}

const WebAuthTokenLogin = (_: Props) => {
  const loginBrowserViaWebAuthToken = C.useSettingsState(s => s.dispatch.loginBrowserViaWebAuthToken)
  return (
    <SettingsSection>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
        <Kb.Text type="Header">Website login</Kb.Text>
        <Kb.Text type="BodySmall">You can use your app to log your web browser into keybase.io.</Kb.Text>
      </Kb.Box2>
      <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
        <Kb.Button
          label={`Open keybase.io in web browser`}
          onClick={loginBrowserViaWebAuthToken}
          mode="Secondary"
          small={true}
        />
      </Kb.ButtonBar>
    </SettingsSection>
  )
}

const DeleteAccount = (props: Props) => (
  <SettingsSection>
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      <Kb.Text type="Header">Delete account</Kb.Text>
      <Kb.Text type="BodySmall">
        This can not be undone. You won’t be able to create a new account with the same username.
      </Kb.Text>
    </Kb.Box2>
    <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
      <Kb.Button
        type="Danger"
        mode="Secondary"
        onClick={props.onDeleteAccount}
        label="Delete account"
        small={true}
      />
    </Kb.ButtonBar>
  </SettingsSection>
)

const AccountSettings = (props: Props) => (
  <Kb.Reloadable
    onReload={props.onReload}
    reloadOnMount={true}
    waitingKeys={[Constants.loadSettingsWaitingKey]}
  >
    <Kb.ScrollView style={Kb.Styles.globalStyles.fullWidth}>
      {props.addedEmail && (
        <Kb.Banner key="clearAdded" color="yellow" onClose={props.onClearAddedEmail}>
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={`Check your inbox! A verification link was sent to ${props.addedEmail}.`}
          />
        </Kb.Banner>
      )}
      {props.supersededPhoneNumber && (
        <Kb.Banner key="supersededPhone" color="yellow" onClose={props.onClearSupersededPhoneNumber}>
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={`Your phone number ${props.supersededPhoneNumber} is now associated with another Keybase user.`}
          />
          <Kb.Button
            onClick={props.onAddPhone}
            label="Add a new number"
            small={true}
            backgroundColor="yellow"
            style={styles.topButton}
          />
        </Kb.Banner>
      )}
      {props.addedPhone && (
        <Kb.Banner key="addedPhone" color="green" onClose={props.onClearAddedPhone}>
          <Kb.BannerParagraph
            bannerColor="green"
            content={[
              'Success! And now you can message anyone on Keybase by phone number. ',
              {onClick: props.onStartPhoneConversation, text: 'Give it a try.'},
            ]}
          />
        </Kb.Banner>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <EmailPhone {...props} />
        <Kb.Divider />
        <Password {...props} />
        <Kb.Divider />
        <WebAuthTokenLogin {...props} />
        <Kb.Divider />
        <DeleteAccount {...props} />
      </Kb.Box2>
    </Kb.ScrollView>
  </Kb.Reloadable>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: {
    minHeight: undefined,
    width: undefined,
  },
  contactRows: Kb.Styles.platformStyles({
    isElectron: {
      paddingTop: Kb.Styles.globalMargins.xtiny,
    },
  }),
  displayInline: Kb.Styles.platformStyles({isElectron: {display: 'inline'}}),
  password: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, 0),
    flexGrow: 1,
  },
  progress: {
    height: 16,
    width: 16,
  },
  section: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.mediumLarge,
        Kb.Styles.globalMargins.medium,
        Kb.Styles.globalMargins.small
      ),
    },
    isElectron: {
      maxWidth: 600,
    },
    isPhone: {
      ...Kb.Styles.padding(
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.medium
      ),
    },
    isTablet: {
      maxWidth: Kb.Styles.globalStyles.largeWidthPercent,
    },
  }),
  topButton: {
    marginTop: Kb.Styles.globalMargins.xtiny,
  },
}))

export default Container
