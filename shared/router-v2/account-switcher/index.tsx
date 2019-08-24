import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as ConfigTypes from '../../constants/types/config'
import {Props as HeaderHocProps} from '../../common-adapters/header-hoc/types'

export type AccountRowItem = {
  account: ConfigTypes.ConfiguredAccount
  fullName: string
}

export type Props = {
  accountRows: Array<AccountRowItem>
  fullname: string
  onAddAccount: () => void
  onCancel: () => void
  onCreateAccount: () => void
  onProfileClick: () => void
  onSelectAccount: (username: string) => void
  username: string
} & HeaderHocProps

const MobileHeader = (props: Props) => (
  <>
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} centerChildren={true} gapEnd={true}>
      <Kb.Avatar username={props.username} onClick={props.onProfileClick} size={128} />
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Text type="BodyBig" onClick={props.onProfileClick}>
          {props.username}
        </Kb.Text>
        <Kb.Text type="BodySmall" lineClamp={1} onClick={props.onProfileClick}>
          {props.fullname}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.buttonBox} fullWidth={true} gap="tiny">
      <Kb.Button
        onClick={props.onAddAccount}
        label="Log in as another user"
        mode="Primary"
        fullWidth={true}
      />
      <Kb.Button
        onClick={props.onCreateAccount}
        label="Create a new account"
        mode="Secondary"
        fullWidth={true}
      />
    </Kb.Box2>
  </>
)
const AccountsRows = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.accountRows.map(entry => (
      <Kb.ListItem2
        type="Small"
        icon={
          <Kb.Avatar
            size={32}
            username={entry.account.username}
            style={entry.account.hasStoredSecret ? undefined : styles.avatarSignedOut}
          />
        }
        firstItem={true}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySemibold">{entry.account.username}</Kb.Text>
            <Kb.Text type="BodySmall" lineClamp={1}>
              {entry.fullName}
            </Kb.Text>
          </Kb.Box2>
        }
        key={entry.account.username}
        onClick={() => props.onSelectAccount(entry.account.username)}
      />
    ))}
  </Kb.Box2>
)
const AccountSwitcher = (props: Props) => (
  <Kb.ScrollView alwaysBounceVertical={false}>
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
      {Styles.isMobile && <MobileHeader {...props} />}
      <Kb.Divider style={styles.divider} />
      {Styles.isMobile ? (
        <AccountsRows {...props} />
      ) : (
        <Kb.ScrollView style={styles.desktopScrollview}>
          <AccountsRows {...props} />
        </Kb.ScrollView>
      )}
      {props.accountRows.length > 0 && !Styles.isMobile && <Kb.Divider style={styles.divider} />}
    </Kb.Box2>
  </Kb.ScrollView>
)

export default Kb.HeaderHoc(AccountSwitcher)

const styles = Styles.styleSheetCreate(() => ({
  avatarSignedOut: {opacity: 0.4},
  buttonBox: Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
  desktopScrollview: {
    maxHeight: 170,
    width: 200,
  },
  divider: {width: '100%'},
  nameText: Styles.platformStyles({
    isElectron: {wordBreak: 'break-all'},
  }),
  row: {
    maxWidth: 200,
    paddingBottom: -Styles.globalMargins.small,
    paddingTop: -Styles.globalMargins.small,
  },
}))
