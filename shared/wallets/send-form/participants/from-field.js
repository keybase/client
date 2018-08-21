// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import Row from '../../participants-row'
import WalletEntry from '../../wallet-entry'
import type {Account} from '.'

type FromFieldProps = {|
  initialAccount: Account,
  accounts: Account[],
|}

type FromFieldState = {|
  selectedAccount: Account,
|}

type DropdownTextProps = {
  text: string,
}

const DropdownText = ({text, ...props}: DropdownTextProps) => (
  <Kb.Box2 {...props} direction="horizontal" centerChildren={true} fullWidth={true}>
    <Kb.Text type="BodySemibold">{text}</Kb.Text>
  </Kb.Box2>
)

class FromField extends React.Component<FromFieldProps, FromFieldState> {
  state = {
    selectedAccount: this.props.initialAccount,
  }

  _createDropdownEntry = (wallet: Account, key: number) => (
    <WalletEntry
      key={key}
      keybaseUser={wallet.user}
      name={wallet.name}
      contents={wallet.contents}
      showWalletIcon={false}
    />
  )

  _createSelectedEntry = (wallet: Account) => (
    <Kb.Box2 direction="horizontal" centerChildren={true} gap="tiny">
      <Kb.Avatar size={32} username={wallet.user} />
      <Kb.Text type="Body">{wallet.name}</Kb.Text>
    </Kb.Box2>
  )

  _onDropdownChange = (node: React.Node) => {
    if (React.isValidElement(node)) {
      console.log(node)
      // console.log(node.type)
    }
    // console.log(instanceof node)
    // if (node) {
    //   this.setState({
    //     selectedWallet: {
    //       name: node.props.name,
    //       user: node.props.keybaseUser
    //     }
    //   })
    // }
  }

  render() {
    let items = [
      <DropdownText key="link-existing" text="Link an existing Stellar account" />,
      <DropdownText key="create-new" text="Create a new account" />,
    ]

    if (this.props.accounts.length > 0) {
      const walletItems = this.props.accounts.map((wallet, index) => this._createDropdownEntry(wallet, index))
      items = walletItems.concat(items)
    }

    return (
      <Row heading="From:" headingAlignment="Right">
        <Kb.Dropdown
          onChanged={this._onDropdownChange}
          items={items}
          selected={this._createSelectedEntry(this.state.selectedAccount)}
        />
      </Row>
    )
  }
}

export default FromField
