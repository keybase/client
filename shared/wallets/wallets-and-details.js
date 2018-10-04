// @flow
import * as React from 'react'
import {Box2} from '../common-adapters'
import WalletList from './wallet-list/container'
import {globalColors, styleSheetCreate} from '../styles'

type Props = {
  children: React.Node,
}

const Wallets = (props: Props) => (
  <Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
    <Box2 direction="vertical" fullHeight={true} style={styles.walletListContainer}>
      <WalletList style={{height: '100%'}} />
    </Box2>
    {props.children}
  </Box2>
)

const styles = styleSheetCreate({
  walletListContainer: {
    backgroundColor: globalColors.blueGrey,
    borderStyle: 'solid',
    flexGrow: 0,
    flexShrink: 0,
    width: 240,
  },
})

export default Wallets
