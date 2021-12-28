import * as React from 'react'
import * as Kb from '../../common-adapters'
import AccountReloader from '../common/account-reloader'
import WalletList from '../wallet-list/container'
import * as Styles from '../../styles'

const WalletsAndDetails = () => (
  <AccountReloader>
    <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.walletListContainer}>
        <WalletList style={{height: '100%'}} />
      </Kb.Box2>
    </Kb.Box2>
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
