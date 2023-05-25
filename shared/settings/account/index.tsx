import * as Constants from '../../constants/settings'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as Styles from '../../styles'
import * as Tabs from '../../constants/tabs'
import EmailPhoneRow from './email-phone-row'
import {anyWaiting} from '../../constants/waiting'
import {isMobile} from '../../styles'

export default () => {
  const _emails = Container.useSelector(state => state.settings.email.emails)
  const _phones = Container.useSelector(state => state.settings.phoneNumbers.phones)
  const addedEmail = Container.useSelector(state => state.settings.email.addedEmail)
  const addedPhone = Container.useSelector(state => state.settings.phoneNumbers.addedPhone)
  const hasPassword = Container.useSelector(state => !state.settings.password.randomPW)
  const waiting = Container.useSelector(state => anyWaiting(state, Constants.loadSettingsWaitingKey))
  const dispatch = Container.useDispatch()
  const _onClearSupersededPhoneNumber = (phone: string) => {
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
const AddButton = (props: AddButtonProps) => {
  const btn = (
    <Kb.Button
      mode="Secondary"
      onClick={props.onClick}
      label={`Add ${props.kind}`}
      small={true}
      disabled={props.disabled}
    />
  )
  return props.disabled ? (
    <Kb.WithTooltip
      tooltip={`You have the maximum number of ${props.kind}s. To add another, first remove one.`}
    >
      {btn}
    </Kb.WithTooltip>
  ) : (
    btn
  )
}
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
            color={Styles.globalColors.blueDark}
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
    passwordLabel = Styles.isMobile ? 'Change' : 'Change password'
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
  const dispatch = Container.useDispatch()

  return (
    <SettingsSection>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
        <Kb.Text type="Header">Website login</Kb.Text>
        <Kb.Text type="BodySmall">You can use your app to log your web browser into keybase.io.</Kb.Text>
      </Kb.Box2>
      <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
        <Kb.Button
          label={`Open keybase.io in web browser`}
          onClick={() => dispatch(SettingsGen.createLoginBrowserViaWebAuthToken())}
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
    <Kb.ScrollView style={Styles.globalStyles.fullWidth}>
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

const styles = Styles.styleSheetCreate(() => ({
  buttonBar: {
    minHeight: undefined,
    width: undefined,
  },
  contactRows: Styles.platformStyles({
    isElectron: {
      paddingTop: Styles.globalMargins.xtiny,
    },
  }),
  displayInline: Styles.platformStyles({isElectron: {display: 'inline'}}),
  password: {
    ...Styles.padding(Styles.globalMargins.xsmall, 0),
    flexGrow: 1,
  },
  progress: {
    height: 16,
    width: 16,
  },
  section: Styles.platformStyles({
    common: {
      ...Styles.padding(
        Styles.globalMargins.small,
        Styles.globalMargins.mediumLarge,
        Styles.globalMargins.medium,
        Styles.globalMargins.small
      ),
    },
    isElectron: {
      maxWidth: 600,
    },
    isPhone: {
      ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, Styles.globalMargins.medium),
    },
    isTablet: {
      maxWidth: Styles.globalStyles.largeWidthPercent,
    },
  }),
  topButton: {
    marginTop: Styles.globalMargins.xtiny,
  },
}))
