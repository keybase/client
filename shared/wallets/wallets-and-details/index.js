// @flow
import * as React from 'react'
import {Box2, Reloadable} from '../../common-adapters'
import WalletList from '../wallet-list/container'
import {globalColors, styleSheetCreate} from '../../styles'
import {loadAccountsWaitingKey} from '../../constants/wallets'

type Props = {
  children: React.Node,
  reload: () => void,
}

const Wallets = (props: Props) => (
  <Reloadable waitingKeys={loadAccountsWaitingKey} onReload={props.reload} reloadOnMount={true}>
    <Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
      <Box2 direction="vertical" fullHeight={true} style={styles.walletListContainer}>
        <WalletList reload={props.reload} style={{height: '100%'}} />
      </Box2>
      {props.children}
    </Box2>
  </Reloadable>
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
