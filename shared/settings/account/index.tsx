import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import EmailPhoneRow from './email-phone-row'
import * as I from 'immutable'

type Props = {
  contactKeys: Array<string>
  hasPassword: boolean
  onAddEmail: () => void
  onAddPhone: () => void
  onDeleteAccount: () => void
  onSetPassword: () => void
}

const EmailPhone = props => (
  <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.section}>
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      <Kb.Text type="Header">Email & phone</Kb.Text>
      <Kb.Text type="BodySmall">
        Secures your account by letting us send important notifications, and allows friends and teammates to
        find you by phone number or email.
      </Kb.Text>
    </Kb.Box2>
    {!!props.contactKeys.size && (
      <Kb.Box2 direction="vertical" style={styles.contactRows} fullWidth={true}>
        {props.contactKeys.map(ck => (
          <EmailPhoneRow contactKey={ck} key={ck} />
        ))}
      </Kb.Box2>
    )}
    <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
      <Kb.Button mode="Secondary" onClick={props.onAddEmail} label="Add email" small={true} />
      <Kb.Button mode="Secondary" onClick={props.onAddPhone} label="Add phone" small={true} />
    </Kb.ButtonBar>
  </Kb.Box2>
)

const Password = props => {
  let passwordLabel
  if (props.hasPassword) {
    passwordLabel = Styles.isMobile ? 'Change' : 'Change password'
  } else {
    passwordLabel = 'Set a password'
  }
  return (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.section}>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
        <Kb.Text type="Header">Password</Kb.Text>
        <Kb.Text type="BodySmall">
          Allows you to log out and log back in, and use the keybase.io website.
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true}>
        {props.hasPassword && (
          <Kb.Text type="BodySemibold" style={styles.password}>
            ********************
          </Kb.Text>
        )}
        <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
          <Kb.Button mode="Secondary" onClick={props.onSetPassword} label={passwordLabel} small={true} />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const DeleteAccount = props => (
  <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.section}>
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
  </Kb.Box2>
)

const AccountSettings = (props: Props) => (
  <Kb.ScrollView>
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <EmailPhone {...props} />
      <Kb.Divider />
      <Password {...props} />
      <Kb.Divider />
      <DeleteAccount {...props} />
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  buttonBar: {
    minHeight: undefined,
    width: undefined,
  },
  contactRows: Styles.platformStyles({
    isElectron: {
      paddingTop: Styles.globalMargins.xtiny,
    },
  }),
  password: {
    ...Styles.padding(Styles.globalMargins.xsmall, 0),
    flexGrow: 1,
  },
  section: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(
        Styles.globalMargins.small,
        Styles.globalMargins.mediumLarge,
        Styles.globalMargins.medium,
        Styles.globalMargins.small
      ),
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, Styles.globalMargins.medium),
    },
  }),
})

export default Kb.HeaderHoc(AccountSettings)
