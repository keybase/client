import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import EmailPhoneRow from './email-phone-row'
import {openURL} from '@/util/misc'
import {loadSettings} from '../load-settings'
import {useNavigation, type NavigationProp} from '@react-navigation/native'
import {useIsFocused} from '@react-navigation/core'
import {usePWState} from '@/stores/settings-password'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {useSettingsEmailState} from '@/stores/settings-email'
import {type settingsAccountTab, settingsPasswordTab} from '@/constants/settings'
import type {SettingsAccountRouteParams} from '../routes'

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
    tooltip={props.disabled ? `You're already at the maximum ${props.kind}s` : undefined}
  />
)

const EmailPhone = ({onEmailVerificationSuccess}: {onEmailVerificationSuccess: (email: string) => void}) => {
  const navigateAppend = C.Router2.navigateAppend
  const _emails = useSettingsEmailState(s => s.emails)
  const _phones = useSettingsPhoneState(s => s.phones)
  const contactKeys = [..._emails.keys(), ...(_phones ? _phones.keys() : [])]
  const tooManyEmails = _emails.size >= 10 // If you change this, also change in keybase/config/prod/email.iced
  const tooManyPhones = !!_phones && _phones.size >= 10 // If you change this, also change in keybase/config/prod/phone_numbers.iced
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeySettingsLoadSettings)
  const readMoreUrlProps = Kb.useClickURL('https://keybase.io/docs/chat/phones-and-emails')
  const onAddEmail = () => {
    navigateAppend({name: 'settingsAddEmail', params: {}})
  }
  const onAddPhone = () => {
    navigateAppend({name: 'settingsAddPhone', params: {}})
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
          <Kb.Text type="BodySmallPrimaryLink" {...readMoreUrlProps}>
            Read more{' '}
            <Kb.Icon type="iconfont-open-browser" sizeType="Tiny" color={Kb.Styles.globalColors.blueDark} />
          </Kb.Text>
        </Kb.Text>
      </Kb.Box2>
      {!!contactKeys.length && (
        <Kb.Box2 direction="vertical" style={styles.contactRows} fullWidth={true}>
          {contactKeys.map(ck => (
            <EmailPhoneRow contactKey={ck} key={ck} onEmailVerificationSuccess={onEmailVerificationSuccess} />
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
  const navigateAppend = C.Router2.navigateAppend
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
  const generateWebAuthToken = C.useRPC(T.RPCGen.configGenerateWebAuthTokenRpcPromise)
  const loginBrowserViaWebAuthToken = () => {
    generateWebAuthToken(
      [undefined],
      link => {
        openURL(link)
      },
      () => {}
    )
  }
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
  const navigateAppend = C.Router2.navigateAppend
  const onDeleteAccount = () => {
    navigateAppend({name: 'deleteConfirm', params: {}})
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

type Props = {route: {params?: SettingsAccountRouteParams}}

const AccountSettings = ({route}: Props) => {
  const addedEmailFromRoute = route.params?.addedEmailBannerEmail
  const addedPhoneFromRoute = !!route.params?.addedPhoneBanner
  const navigation =
    useNavigation<
      NavigationProp<
        Record<typeof settingsAccountTab, SettingsAccountRouteParams | undefined>,
        typeof settingsAccountTab
      >
    >()
  const isFocused = useIsFocused()
  const emails = useSettingsEmailState(s => s.emails)
  const phones = useSettingsPhoneState(s => s.phones)
  const deletePhoneNumber = C.useRPC(T.RPCGen.phoneNumbersDeletePhoneNumberRpcPromise)
  const [addedEmail, setAddedEmail] = React.useState(addedEmailFromRoute ?? '')
  const [addedPhone, setAddedPhone] = React.useState(addedPhoneFromRoute)
  const {loadHasRandomPw} = usePWState(
    C.useShallow(s => ({
      loadHasRandomPw: s.dispatch.loadHasRandomPw,
    }))
  )
  const {navigateAppend, switchTab} = C.Router2
  const _onClearSupersededPhoneNumber = (phone: string) => {
    deletePhoneNumber(
      [{phoneNumber: phone}],
      () => {},
      () => {}
    )
  }
  React.useEffect(() => {
    if (!addedEmailFromRoute) {
      return
    }
    setAddedEmail(addedEmailFromRoute)
    navigation.setParams({addedEmailBannerEmail: undefined})
  }, [addedEmailFromRoute, navigation])
  React.useEffect(() => {
    if (!addedPhoneFromRoute) {
      return
    }
    setAddedPhone(true)
    navigation.setParams({addedPhoneBanner: undefined})
  }, [addedPhoneFromRoute, navigation])
  React.useEffect(() => {
    if (isFocused) {
      return
    }
    setAddedEmail('')
    setAddedPhone(false)
  }, [isFocused])
  React.useEffect(() => {
    if (!addedEmail) {
      return
    }
    const addedEmailRow = emails.get(addedEmail)
    if (!addedEmailRow || addedEmailRow.isVerified) {
      setAddedEmail('')
    }
  }, [addedEmail, emails])
  const onClearAddedEmail = () => setAddedEmail('')
  const onClearAddedPhone = () => setAddedPhone(false)
  const onReload = () => {
    loadSettings()
    loadHasRandomPw()
  }
  const onStartPhoneConversation = () => {
    switchTab(C.Tabs.chatTab)
    navigateAppend({name: 'chatNewChat', params: {namespace: 'chat'}})
    setAddedPhone(false)
  }
  const _supersededPhoneNumber = phones && [...phones.values()].find(p => p.superseded)
  const supersededKey = _supersededPhoneNumber?.e164
  const onClearSupersededPhoneNumber = () => supersededKey && _onClearSupersededPhoneNumber(supersededKey)
  const supersededPhoneNumber = _supersededPhoneNumber ? _supersededPhoneNumber.displayNumber : undefined
  const onAddPhone = () => {
    navigateAppend({name: 'settingsAddPhone', params: {}})
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
              style={Kb.Styles.collapseStyles([styles.topButton, styles.primaryOnYellow])}
              labelStyle={styles.primaryOnYellowLabel}
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
          <EmailPhone onEmailVerificationSuccess={setAddedEmail} />
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
  password: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, 0),
    flexGrow: 1,
  },
  primaryOnYellow: {backgroundColor: Kb.Styles.globalColors.white},
  primaryOnYellowLabel: {color: Kb.Styles.globalColors.brown_75OrYellow},
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
