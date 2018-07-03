// @flow
import * as React from 'react'
import {Box2} from '../common-adapters'
import WalletList from './wallet-list/container'
import Wallet from './wallet/container'
import {globalColors, styleSheetCreate} from '../styles'

type Props = {
  refresh: () => void,
  waitingKey: string,
}

const Wallets = ({refresh, waitingKey}: Props) => (
  <Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
    <Box2 direction="vertical" fullHeight={true} style={styles.walletListContainer}>
      <WalletList style={{height: '100%'}} />
    </Box2>
    <Wallet />
  </Box2>
)

const styles = styleSheetCreate({
  walletListContainer: {
    backgroundColor: globalColors.blue5,
    borderRightColor: globalColors.black_05,
    borderRightWidth: 1,
    borderStyle: 'solid',
    flexBasis: 240,
  },
})

export default Wallets
