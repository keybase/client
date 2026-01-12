import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import EmailPhoneRow from './email-phone-row'
import {usePWState} from '@/stores/settings-password'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useSettingsState, settingsPasswordTab} from '@/stores/settings'

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

const EmailPhone = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _emails = useSettingsEmailState(s => s.emails)
  const _phones = useSettingsPhoneState(s => s.phones)
  const contactKeys = [..._emails.keys(), ...(_phones ? _phones.keys() : [])]
  const tooManyEmails = _emails.size >= 10 // If you change this, also change in keybase/config/prod/email.iced
  const tooManyPhones = !!_phones && _phones.size >= 10 // If you change this, also change in keybase/config/prod/phone_numbers.iced
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsLoadSettings)
  const onAddEmail = () => {
    navigateAppend('settingsAddEmail')
  }
  const onAddPhone = () => {
    navigateAppend('settingsAddPhone')
  }
  return (
    <SettingsSection>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
        <Kb.Box2 alignItems="center" direction="horizontal" gap="tiny" fullWidth={true}>
          <Kb.Text type="Header">Email & phone</Kb.Text>
          {waiting && <Kb.ProgressIndicator style={styles.progress} />}
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
      {!!contactKeys.length && (
        <Kb.Box2 direction="vertical" style={styles.contactRows} fullWidth={true}>
          {contactKeys.map(ck => (
            <EmailPhoneRow contactKey={ck} key={ck} />
          ))}
        </Kb.Box2>
      )}
      <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
        <AddButton onClick={onAddEmail} kind="email" disabled={tooManyEmails} />
        <AddButton onClick={onAddPhone} kind="phone number" disabled={tooManyPhones} />
      </Kb.ButtonBar>
    </SettingsSection>
  )
}

const Password = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onSetPassword = () => {
    navigateAppend(settingsPasswordTab)
  }
  const hasPassword = usePWState(s => !s.randomPW)
  let passwordLabel: string
  if (hasPassword) {
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
        {hasPassword && (
          <Kb.Text type="BodySemibold" style={styles.password}>
            ********************
          </Kb.Text>
        )}
        <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
          <Kb.Button mode="Secondary" onClick={onSetPassword} label={passwordLabel} small={true} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </SettingsSection>
  )
}

const WebAuthTokenLogin = () => {
  const loginBrowserViaWebAuthToken = useSettingsState(s => s.dispatch.loginBrowserViaWebAuthToken)
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

const DeleteAccount = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDeleteAccount = () => {
    navigateAppend('deleteConfirm')
  }
  return (
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
          onClick={onDeleteAccount}
          label="Delete account"
          small={true}
        />
      </Kb.ButtonBar>
    </SettingsSection>
  )
}

const AccountSettings = () => {
  const {addedEmail, resetAddedEmail} = useSettingsEmailState(
    C.useShallow(s => ({
      addedEmail: s.addedEmail,
      resetAddedEmail: s.dispatch.resetAddedEmail,
    }))
  )
  const {
    _phones,
    addedPhone,
    clearAddedPhone,
    editPhone,
  } = useSettingsPhoneState(
    C.useShallow(s => ({
      _phones: s.phones,
      addedPhone: s.addedPhone,
      clearAddedPhone: s.dispatch.clearAddedPhone,
      editPhone: s.dispatch.editPhone,
    }))
  )
  const {loadSettings} = useSettingsState(
    C.useShallow(s => ({
      loadSettings: s.dispatch.loadSettings,
    }))
  )
  const {loadHasRandomPw, loadRememberPassword} = usePWState(
    C.useShallow(s => ({
      loadHasRandomPw: s.dispatch.loadHasRandomPw,
      loadRememberPassword: s.dispatch.loadRememberPassword,
    }))
  )
  const {navigateAppend, switchTab} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
      switchTab: s.dispatch.switchTab,
    }))
  )
  const _onClearSupersededPhoneNumber = (phone: string) => {
    editPhone(phone, true)
  }
  const onClearAddedEmail = resetAddedEmail
  const onClearAddedPhone = clearAddedPhone
  const onReload = () => {
    loadSettings()
    loadRememberPassword()
    loadHasRandomPw()
  }
  const onStartPhoneConversation = () => {
    switchTab(C.Tabs.chatTab)
    navigateAppend({props: {namespace: 'chat2'}, selected: 'chatNewChat'})
    clearAddedPhone()
  }
  const _supersededPhoneNumber = _phones && [..._phones.values()].find(p => p.superseded)
  const supersededKey = _supersededPhoneNumber?.e164
  const onClearSupersededPhoneNumber = () => supersededKey && _onClearSupersededPhoneNumber(supersededKey)
  const supersededPhoneNumber = _supersededPhoneNumber ? _supersededPhoneNumber.displayNumber : undefined
  const onAddPhone = () => {
    navigateAppend('settingsAddPhone')
  }

  return (
    <Kb.Reloadable onReload={onReload} reloadOnMount={true} waitingKeys={[C.waitingKeySettingsLoadSettings]}>
      <Kb.ScrollView style={Kb.Styles.globalStyles.fullWidth}>
        {addedEmail && (
          <Kb.Banner key="clearAdded" color="yellow" onClose={onClearAddedEmail}>
            <Kb.BannerParagraph
              bannerColor="yellow"
              content={`Check your inbox! A verification link was sent to ${addedEmail}.`}
            />
          </Kb.Banner>
        )}
        {supersededPhoneNumber && (
          <Kb.Banner key="supersededPhone" color="yellow" onClose={onClearSupersededPhoneNumber}>
            <Kb.BannerParagraph
              bannerColor="yellow"
              content={`Your phone number ${supersededPhoneNumber} is now associated with another Keybase user.`}
            />
            <Kb.Button
              onClick={onAddPhone}
              label="Add a new number"
              small={true}
              backgroundColor="yellow"
              style={styles.topButton}
            />
          </Kb.Banner>
        )}
        {addedPhone && (
          <Kb.Banner key="addedPhone" color="green" onClose={onClearAddedPhone}>
            <Kb.BannerParagraph
              bannerColor="green"
              content={[
                'Success! And now you can message anyone on Keybase by phone number. ',
                {onClick: onStartPhoneConversation, text: 'Give it a try.'},
              ]}
            />
          </Kb.Banner>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
          <EmailPhone />
          <Kb.Divider />
          <Password />
          <Kb.Divider />
          <WebAuthTokenLogin />
          <Kb.Divider />
          <DeleteAccount />
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Reloadable>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: {
    minHeight: undefined,
    width: undefined,
  },
  contactRows: Kb.Styles.platformStyles({
    isElectron: {paddingTop: Kb.Styles.globalMargins.xtiny},
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
    isElectron: {maxWidth: 600},
    isPhone: {
      ...Kb.Styles.padding(
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.medium
      ),
    },
    isTablet: {maxWidth: Kb.Styles.globalStyles.largeWidthPercent},
  }),
  topButton: {marginTop: Kb.Styles.globalMargins.xtiny},
}))

export default AccountSettings
