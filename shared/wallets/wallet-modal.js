// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type WalletModalProps = {|
  children: React.Node,
  onClose: () => void,
  containerStyle?: Styles.StylesCrossPlatform,
  bottomButtons?: Array<React.Node>, // Buttons to be placed in the bottom Button Bar
|}

const WalletModal = (props: WalletModalProps) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      style={Styles.collapseStyles([styles.container, props.containerStyle])}
    >
      {props.children}
      {props.bottomButtons &&
        props.bottomButtons.length > 0 && (
          <Kb.Box2 direction="vertical" style={styles.buttonBarContainer} fullWidth={true}>
            <Kb.ButtonBar style={styles.buttonBar}>{props.bottomButtons}</Kb.ButtonBar>
          </Kb.Box2>
        )}
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
  buttonBarContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  buttonBar: {
    minHeight: 0,
  },
})

export default WalletModal
