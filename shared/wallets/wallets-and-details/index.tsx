import * as React from 'react'
import {Box2} from '../../common-adapters'
import AccountReloader from '../common/account-reloader'
import WalletList from '../wallet-list/container'
import * as Styles from '../../styles'

type Props = {
  children: React.ReactNode
}

const WalletsAndDetails = (props: Props) => (
  <AccountReloader>
    <Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
      <Box2 direction="vertical" fullHeight={true} style={styles.walletListContainer}>
        <WalletList style={{height: '100%'}} />
      </Box2>
      <Box2 direction="vertical" fullHeight={true} style={Styles.globalStyles.flexOne}>
        {props.children}
      </Box2>
    </Box2>
  </AccountReloader>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      walletListContainer: {
        backgroundColor: Styles.globalColors.blueGrey,
        borderStyle: 'solid',
        flexGrow: 0,
        flexShrink: 0,
        minWidth: Styles.globalStyles.mediumSubNavWidth,
        width: Styles.globalStyles.mediumSubNavWidth,
      },
    } as const)
)

export default WalletsAndDetails
