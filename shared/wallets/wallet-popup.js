// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {compose, renameProp} from 'recompose'

type WalletModalProps = {|
  children: React.Node,
  onClose: () => void,
  containerStyle?: Styles.StylesCrossPlatform,
  // Since the header is only displayed on mobile, its styles only apply to mobile.
  headerStyle?: Styles.StylesCrossPlatform,
  // Buttons to be placed in the bottom Button Bar.
  // If none are included, the bar is not rendered.
  bottomButtons?: Array<React.Node>,
|}

const WalletPopup = (props: WalletModalProps) => (
  <Kb.Box2
    direction="vertical"
    fullHeight={true}
    fullWidth={true}
    centerChildren={true}
    style={Styles.collapseStyles([styles.container, props.containerStyle])}
  >
    {props.children}
    {props.bottomButtons &&
      props.bottomButtons.length > 0 && (
        <Kb.Box2 direction="vertical" style={styles.buttonBarContainer} fullWidth={true}>
          <Kb.ButtonBar
            direction={Styles.isMobile ? 'column' : 'row'}
            fullWidth={Styles.isMobile}
            style={styles.buttonBar}
          >
            {props.bottomButtons}
          </Kb.ButtonBar>
        </Kb.Box2>
      )}
  </Kb.Box2>
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
      borderRadius: 'inherit',
      paddingBottom: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.xlarge,
      textAlign: 'center',
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.xlarge,
    },
  }),
  buttonBarContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 0,
    },
  }),
})

export default compose(renameProp('onClose', 'onCancel'), Kb.HeaderOrPopup)(WalletPopup)
