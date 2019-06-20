import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import HeaderHOC from '../../common-adapters/header-hoc'
import * as ConfigTypes from '../../constants/types/config'
import {Props as HeaderHocProps} from '../../common-adapters/header-hoc/types'

export type AccountRowItem = {
  account: ConfigTypes.ConfiguredAccount
  fullName: string
}
export type RowsProps = {
  accountRows: Array<AccountRowItem>
  onAddAccount: () => void
  onCreateAccount: () => void
  onSelectAccount: (username: string) => void
}

export type Props = {
  fullname: string
  onCancel: () => void
  onProfileClick: () => void
  username: string
} & RowsProps &
  HeaderHocProps

const AccountRow = ({
  entry,
  onSelectAccount,
}: {
  entry: AccountRowItem
  onSelectAccount: (username: string) => void
}) => (
  <Kb.NameWithIcon
    clickType={onSelectAccount}
    horizontal={true}
    username={entry.account.username}
    metaOne={
      <Kb.Text type="BodySmall" lineClamp={1} style={styles.nameText}>
        {entry.fullName}
      </Kb.Text>
    }
    onClick={() => {
      onSelectAccount(entry.account.username)
    }}
    containerStyle={styles.row}
    avatarStyle={!entry.account.hasStoredSecret && styles.avatarSignedOut}
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
        {props.accountRows.map(entry => (
          <Kb.ListItem2
            type="Small"
            icon={
              <Kb.Avatar
                size={32}
                username={entry.account.username}
                style={!entry.account.hasStoredSecret && styles.avatarSignedOut}
              />
            }
            firstItem={false}
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
    </Kb.Box2>
  </Kb.ScrollView>
)

export default HeaderHOC(AccountSwitcherMobile)

export const asRows = (props: RowsProps): Kb.MenuItems => {
  const avatarRows: Kb.MenuItems = props.accountRows.map(entry => ({
    title: entry.account.username,
    view: <AccountRow entry={entry} onSelectAccount={props.onSelectAccount} />,
  }))
  return [
    'Divider' as const,
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
