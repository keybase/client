// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {|
  hasPassword: boolean,
  onAddEmail: () => void,
  onAddPhone: () => void,
  onDeleteAccount: () => void,
  onSetPassword: () => void,
|}

const AccountSettings = (props: Props) => {
  let passwordLabel = props.hasPassword ? 'Change password' : 'Set a password'
  if (props.hasPassword && Styles.isMobile) {
    passwordLabel = 'Change'
  }
  return (
    <Kb.ScrollView>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {/* Email + Phone */}
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.section}>
          <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="Header">Email & phone</Kb.Text>
            <Kb.Text type="BodySmall">
              Secures your account by letting us send important notifications, and allows friends and
              teammates to find you by phone number or email.
            </Kb.Text>
          </Kb.Box2>
          <Kb.ButtonBar align="flex-start" style={styles.buttonBar}>
            <Kb.Button mode="Secondary" onClick={props.onAddEmail} label="Add email" small={true} />
            <Kb.Button mode="Secondary" onClick={props.onAddPhone} label="Add phone" small={true} />
          </Kb.ButtonBar>
        </Kb.Box2>

        {/* Password */}
        <Kb.Divider />
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

        {/* Delete account */}
        <Kb.Divider />
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
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate({
  buttonBar: {
    minHeight: undefined,
    width: undefined,
  },
  password: {
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

export default AccountSettings
