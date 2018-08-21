// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import Row from './row'
import WalletEntry from './wallet-entry'
import type {Wallet} from '.'

type FromFieldProps = {|
  isConfirm: boolean,
  initialWallet: Wallet,
  wallets?: Wallet[],
|}

type FromFieldState = {|
  selectedWallet: Wallet,
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
    selectedWallet: this.props.initialWallet,
  }

  _createDropdownEntry = (wallet: Wallet, key: number) => (
    <WalletEntry
      key={key}
      keybaseUser={wallet.user}
      name={wallet.name}
      contents={wallet.contents}
      showWalletIcon={false}
    />
  )

  _createSelectedEntry = (wallet: Wallet) => (
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

    if (this.props.wallets && this.props.wallets.length > 0) {
      const walletItems = this.props.wallets.map((wallet, index) =>
        this._createDropdownEntry(wallet, index + 1)
      )
      items = walletItems.concat(items)
    }

    items.unshift(this._createDropdownEntry(this.state.selectedWallet, 0))

    return (
      <Row heading="From:">
        {this.props.isConfirm && (
          <WalletEntry
            keybaseUser={this.props.initialWallet.user}
            name={this.props.initialWallet.name}
            contents={this.props.initialWallet.contents}
          />
        )}
        {/* TODO: Add wallet dropdown for wallet->wallet */}
        {!this.props.isConfirm && (
          <Kb.Dropdown
            onChanged={this._onDropdownChange}
            items={items}
            selected={this._createSelectedEntry(this.state.selectedWallet)}
          />
        )}
      </Row>
    )
  }
}

export default FromField
