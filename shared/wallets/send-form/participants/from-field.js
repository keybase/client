// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow} from '../../common'
import type {AccountID} from '../../../constants/types/wallets'
import {SelectedEntry, DropdownEntry} from './dropdown'
import type {Account} from '.'

type FromFieldProps = {|
  accounts: Account[],
  initialAccount: Account,
  onChangeSelectedAccount: (id: AccountID) => void,
  user: string,
|}

type FromFieldState = {|
  selectedAccount: Account,
|}

class FromField extends React.Component<FromFieldProps, FromFieldState> {
  state = {
    selectedAccount: this.props.initialAccount,
  }

  onDropdownChange = (node: React.Node) => {
    if (React.isValidElement(node)) {
      // $FlowIssue React.isValidElement refinement doesn't happen, see https://github.com/facebook/flow/issues/6392
      const element = (node: React.Element<any>)
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
  dropdownSelectedBox: Styles.platformStyles({
    isMobile: {minHeight: 32},
  }),
  dropdown: Styles.platformStyles({
    isMobile: {height: 32},
  }),
  dropdownContainer: Styles.platformStyles({
    isMobile: {flexGrow: 1},
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
