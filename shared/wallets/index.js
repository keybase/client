// @flow
import * as React from 'react'
import {Box2} from '../common-adapters'
import WalletList from './wallet-list/container'
import Assets from './asset/container'

type Props = {
  refresh: () => void,
  waitingKey: string,
}

const Wallets = ({refresh, waitingKey}: Props) => (
  <Box2 direction="horizontal" fullHeight={true} fullWidth={true} gap="xtiny">
    <WalletList style={{height: '100%', maxWidth: 240}} />
    <Box2 direction="vertical" style={{flexGrow: 1}} fullHeight={true} gap="small" gapStart={true} gapEnd={true}>
      <Assets />
    </Box2>
  </Box2>
)

export default Wallets
