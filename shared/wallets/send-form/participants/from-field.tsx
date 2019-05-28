import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow} from '../../common'
import {AccountID} from '../../../constants/types/wallets'
import {SelectedEntry, DropdownEntry} from './dropdown'
import {Account} from '.'

type FromFieldProps = {
  accounts: Account[]
  initialAccount: Account
  onChangeSelectedAccount: (id: AccountID) => void
  user: string
}

type FromFieldState = {
  selectedAccount: Account
}

class FromField extends React.Component<FromFieldProps, FromFieldState> {
  state = {
    selectedAccount: this.props.initialAccount,
  }

  onDropdownChange = (node: React.ReactNode) => {
    if (React.isValidElement(node)) {
      const element: React.ReactElement = node
      this.setState({selectedAccount: element.props.account})
      this.props.onChangeSelectedAccount(element.props.account.id)
    }
  }

  render() {
    const items = this.props.accounts.map(account => (
      <DropdownEntry key={account.id} account={account} user={this.props.user} />
    ))

    return (
      <ParticipantsRow heading="From" headingAlignment="Right" bottomDivider={false} style={styles.row}>
        <Kb.Dropdown
          onChanged={this.onDropdownChange}
          items={items}
          style={styles.dropdown}
          selectedBoxStyle={styles.dropdownSelectedBox}
          selected={<SelectedEntry account={this.state.selectedAccount} user={this.props.user} />}
        />
      </ParticipantsRow>
    )
  }
}

const styles = Styles.styleSheetCreate({
  dropdown: Styles.platformStyles({
    isMobile: {height: 32},
  }),
  dropdownContainer: Styles.platformStyles({
    isMobile: {flexGrow: 1},
  }),
  dropdownSelectedBox: Styles.platformStyles({
    isMobile: {minHeight: 32},
  }),
  row: Styles.platformStyles({
    isMobile: {
      height: 40,
      paddingBottom: 4,
      paddingTop: 4,
    },
  }),
})

export default FromField
