import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {AccountEntry} from '../../common'
import type {Account} from '.'

type DropdownTextProps = {
  spinner?: boolean
  text: string
}

// A text selection, e.g., "Create a new account".
export const DropdownText = ({text, spinner, ...props}: DropdownTextProps) => (
  <Kb.Box2 {...props} direction="horizontal" fullWidth={true} style={styles.selectedEntry}>
    {spinner && <Kb.Animation animationType="spinner" style={styles.spinner} />}
    <Kb.Text type="BodySemibold">{text}</Kb.Text>
  </Kb.Box2>
)

type SelectedEntryProps = {
  account: Account
  spinner?: boolean
  user: string
}

// The display of the selected account in the dropdown.
export const SelectedEntry = ({account, spinner, user, ...props}: SelectedEntryProps) => (
  <Kb.Box2 {...props} direction="horizontal" gap="tiny" fullWidth={true} style={styles.selectedEntry}>
    {spinner && <Kb.Animation animationType="spinner" style={styles.spinner} />}
    {account.isDefault && <Kb.Avatar size={16} username={user} />}
    <Kb.Text type="BodySemibold" style={styles.text}>
      {!account.unknown && account.name}
    </Kb.Text>
  </Kb.Box2>
)

type DropdownEntryProps = {
  account: Account
  user: string
}

// The display of an entry in the dropdown popup.
export const DropdownEntry = (props: DropdownEntryProps) => (
  <AccountEntry
    keybaseUser={props.user}
    name={props.account.name}
    contents={props.account.contents}
    isDefault={props.account.isDefault}
    showWalletIcon={false}
    fullWidth={true}
    style={styles.dropdownEntry}
  />
)

const styles = Styles.styleSheetCreate(() => ({
  dropdownEntry: {
    ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.xsmall),
  },
  selectedEntry: {
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.xsmall,
  },
  spinner: Styles.platformStyles({
    isElectron: {
      height: 16,
      marginRight: Styles.globalMargins.tiny,
      width: 16,
    },
    isMobile: {
      height: 28,
      marginRight: Styles.globalMargins.xtiny,
      width: 28,
    },
  }),
  text: Styles.platformStyles({
    isElectron: {
      maxWidth: 140,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
}))
