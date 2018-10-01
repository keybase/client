// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
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
      <ParticipantsRow heading="From" headingAlignment="Right" bottomDivider={false}>
        <Kb.Dropdown
          onChanged={this.onDropdownChange}
          items={items}
          selected={<SelectedEntry account={this.state.selectedAccount} user={this.props.user} />}
        />
      </ParticipantsRow>
    )
  }
}

export default FromField
