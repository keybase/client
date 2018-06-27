// @flow
import * as React from 'react'
import {Box2} from '../common-adapters'
import WalletList from './wallet-list/container'
import Assets from './asset/container'
import {globalColors, styleSheetCreate} from '../styles'

type Props = {
  refresh: () => void,
  waitingKey: string,
}

const Wallets = ({refresh, waitingKey}: Props) => (
  <Box2 direction="horizontal" fullHeight={true} fullWidth={true} gap="xtiny">
    <Box2 direction="vertical" fullHeight={true} style={styles.walletListContainer}>
      <WalletList style={{height: '100%'}} />
    </Box2>
    <Box2
      direction="vertical"
      style={{flexGrow: 1}}
      fullHeight={true}
      gap="small"
      gapStart={true}
      gapEnd={true}
    >
      <Assets />
    </Box2>
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
