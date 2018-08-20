// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import Row from './row'
import WalletEntry from './wallet-entry'
import type {Wallet} from '.'

type FromFieldProps = {|
  isConfirm: boolean,
  selectedWallet: Wallet,
  wallets?: Wallet[],
|}

type DropdownTextProps = {
  text: string,
}

const DropdownText = ({text, ...props}: DropdownTextProps) => (
  <Kb.Box2 {...props} direction="horizontal" centerChildren={true} fullWidth={true}>
    <Kb.Text type="BodySemibold">{text}</Kb.Text>
  </Kb.Box2>
)

const FromField = (props: FromFieldProps) => {
  let items = [
    <DropdownText key="link-existing" text="Link an existing Stellar account" />,
    <DropdownText key="create-new" text="Create a new account" />,
  ]

  if (props.wallets && props.wallets.length > 0) {
    const walletItems = props.wallets.map((wallet, index) => (
      <WalletEntry key={index + 1} keybaseUser={wallet.user} name={wallet.name} contents={wallet.contents} />
    ))
    items = walletItems.concat(items)
  }

  const selectedWallet = (
    <WalletEntry
      key={0}
      keybaseUser={props.selectedWallet.user}
      name={props.selectedWallet.name}
      contents={props.selectedWallet.contents}
    />
  )
  items.unshift(selectedWallet)

  return (
    <Row heading="From:">
      {props.isConfirm && (
        <WalletEntry
          keybaseUser={props.selectedWallet.user}
          name={props.selectedWallet.name}
          contents={props.selectedWallet.contents}
        />
      )}
      {/* TODO: Add wallet dropdown for wallet->wallet */}
      {!props.isConfirm && (
        <Kb.Dropdown onChanged={item => console.log(item)} items={items} selected={selectedWallet} />
      )}
    </Row>
  )
}

export default FromField
