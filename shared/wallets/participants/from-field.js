// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import Row from './row'
import WalletEntry from './wallet-entry'

type FromFieldProps = {|
  isConfirm: boolean,
  username: string,
  walletName: string,
  walletContents: string,
|}

type DropdownTextProps = {
  text: string,
}

const DropdownText = ({text, ...props}: DropdownTextProps) => (
  <Kb.Box2 {...props} direction="horizontal" centerChildren={true} fullWidth={true}>
    <Kb.Text type="BodySemibold">{text}</Kb.Text>
  </Kb.Box2>
)

const items = [
  <DropdownText key="link-existing" text="Link an existing Stellar account" />,
  <DropdownText key="create-new" text="Create a new account" />,
]

const FromField = (props: FromFieldProps) => (
  <Row heading="From:">
    {props.isConfirm && (
      <WalletEntry keybaseUser={props.username} name={props.walletName} contents={props.walletContents} />
    )}
    {/* TODO: Add wallet dropdown for wallet->wallet */}
    {!props.isConfirm && <Kb.Dropdown onChanged={() => {}} items={items} />}
  </Row>
)

export default FromField
