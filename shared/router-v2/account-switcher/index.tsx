import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import HeaderHOC from '../../common-adapters/header-hoc'
type AccountEntry = {
  username: string
  realName: string
  signedIn: boolean
}

type RowsProps = {
  onAddAccount: () => void
  onCreateAccount: () => void
  onSelectAccount: (username: string) => void
  rows: Array<AccountEntry>
}

type Props = {
  fullname: string
  onCancel: () => void
  onProfileClick: () => void
  onSignOut: () => void
  username: string
} & RowsProps

const AccountRow = ({
  entry,
  onSelectAccount,
}: {
  entry: AccountEntry
  onSelectAccount: (username: string) => void
}) => (
  <Kb.NameWithIcon
    horizontal={true}
    username={entry.username}
    metaOne={
      <Kb.Text type="BodySmall" lineClamp={1} style={styles.nameText}>
        {entry.realName}
      </Kb.Text>
    }
    onClick={() => {
      onSelectAccount(entry.username)
    }}
    containerStyle={styles.row}
    avatarStyle={!entry.signedIn && styles.avatarSignedOut}
  />
)

const AccountSwitcherMobile = (props: Props) => (
  <Kb.ScrollView>
    <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} fullWidth={true} centerChildren={true}>
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
        <Kb.Button onClick={props.onAddAccount} label="Add another account" mode="Primary" fullWidth={true} />
        <Kb.Button
          onClick={props.onCreateAccount}
          label="Create a new account"
          mode="Secondary"
          fullWidth={true}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {props.rows.map(entry => (
          <Kb.ListItem2
            type="Small"
            icon={
              <Kb.Avatar
                size={32}
                username={entry.username}
                style={!entry.signedIn && styles.avatarSignedOut}
              />
            }
            firstItem={false}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodySemibold">{entry.username}</Kb.Text>
                <Kb.Text type="BodySmall" lineClamp={1}>
                  {entry.realName}
                </Kb.Text>
              </Kb.Box2>
            }
            key={entry.username}
            onClick={() => props.onSelectAccount(entry.username)}
          />
        ))}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ScrollView>
)

export default HeaderHOC(AccountSwitcherMobile)

export const asRows = (props: RowsProps): Kb.MenuItems => {
  let avatarRows: Kb.MenuItems = ['Divider']
  avatarRows = avatarRows.concat(
    props.rows.map(entry => ({
      title: entry.username,
      view: <AccountRow entry={entry} onSelectAccount={props.onSelectAccount} />,
    }))
  )
  return [
    ...avatarRows,
    'Divider' as const,
    {
      onClick: props.onAddAccount,
      title: 'Add another account',
    },
    {
      onClick: props.onCreateAccount,
      title: 'Create a new account',
    },
  ]
}

const styles = Styles.styleSheetCreate({
  avatarSignedOut: {opacity: 0.4},
  buttonBox: Styles.padding(
    0,
    Styles.globalMargins.small,
    Styles.globalMargins.tiny,
    Styles.globalMargins.small
  ),
  nameText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  row: {
    maxWidth: 200,
    paddingBottom: -Styles.globalMargins.small,
    paddingTop: -Styles.globalMargins.small,
  },
})
