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

const FromField = (props: FromFieldProps) => (
  <Row heading="From:">
    {props.isConfirm && (
      <WalletEntry keybaseUser={props.username} name={props.walletName} contents={props.walletContents} />
    )}
    {/* TODO: Add wallet dropdown for wallet->wallet */}
    {!props.isConfirm && (
      <Kb.Dropdown
        onChanged={() => {}}
        items={[
          <WalletEntry
            key={0}
            keybaseUser={props.username}
            name={props.walletName}
            contents={props.walletContents}
            showWalletIcon={false}
            center={true}
          />,
        ]}
      />
    )}
  </Row>
)

export default FromField
