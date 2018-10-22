// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {compose, renameProp, withProps} from 'recompose'

type WalletModalProps = {|
  children: React.Node,
  onBack?: () => void,
  onClose: () => void,
  containerStyle?: Styles.StylesCrossPlatform,
  // Since the header is only displayed on mobile, its styles only apply to mobile.
  headerStyle?: Styles.StylesCrossPlatform,
  // Buttons to be placed in the bottom Button Bar.
  // If none are included, the bar is not rendered.
  bottomButtons?: Array<React.Node>,
  buttonBarDirection?: 'column' | 'row',
  buttonBarStyle?: Styles.StylesCrossPlatform,
|}

const WalletPopup = (props: WalletModalProps) => (
  <Kb.Box2 direction="vertical" style={styles.outerContainer}>
    <Kb.ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContentContainer}>
      <Kb.Box2
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        centerChildren={true}
        style={Styles.collapseStyles([
          styles.container,
          props.onBack ? {paddingTop: Styles.globalMargins.small} : {},
          props.containerStyle,
        ])}
      >
        {props.children}
        {props.bottomButtons &&
          props.bottomButtons.length > 0 && (
            <Kb.Box2 direction="vertical" style={styles.buttonBarContainer} fullWidth={true}>
              <Kb.ButtonBar
                direction={props.buttonBarDirection || (Styles.isMobile ? 'column' : 'row')}
                fullWidth={Styles.isMobile}
                style={Styles.collapseStyles([styles.buttonBar, props.buttonBarStyle])}
              >
                {props.bottomButtons}
              </Kb.ButtonBar>
            </Kb.Box2>
          )}
      </Kb.Box2>
    </Kb.ScrollView>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  outerContainer: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
      borderRadius: 4,
    },
    isMobile: {
      width: '100%',
    },
  }),
  header: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
    },
  }),
  container: Styles.platformStyles({
    common: {
      flexGrow: 1,
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
    isElectron: {
      borderRadius: 'inherit',
      paddingBottom: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.xlarge,
      textAlign: 'center',
    },
    isMobile: {},
  }),
  buttonBarContainer: Styles.platformStyles({
    common: {justifyContent: 'flex-end'},
    isElectron: {flex: 1},
  }),
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 0,
    },
  }),
  scrollView: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    width: '100%',
  },
  scrollViewContentContainer: {...Styles.globalStyles.flexBoxColumn, flexGrow: 1},
})

export default compose(
  renameProp('onClose', 'onCancel'),
  withProps({
    style: Styles.isMobile ? null : {height: 525},
  }),
  Kb.HeaderOrPopupWithHeader
)(WalletPopup)
