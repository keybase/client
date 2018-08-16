// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type Props = {|
  children: React.Node,
  onClose: () => void,
|}

const WalletModal = (props: Props) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2 direction="vertical" style={styles.container} centerChildren={true}>
      {props.children}
    </Kb.Box2>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      alignItems: 'center',
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
    isElectron: {
      height: 525,
      width: 360,
      paddingBottom: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.xlarge,
      textAlign: 'center',
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium,
    },
  }),
})

export default WalletModal
