import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import AccountPageHeader from './account-page-header'
import {compose, withProps} from 'recompose'

// WalletPopup - wraps all stellar modals except for the send / request forms.
//
// Handles platform split between desktop modal / native screen + header

type WalletPopupProps = {
  onExit?: () => void // called onExit so to avoid name conflict with other header props
  // Buttons to be placed in the bottom Button Bar.
  // If none are included, the bar is not rendered.
  bottomButtons?: Array<React.ReactNode>
  buttonBarDirection?: 'column' | 'row'
  buttonBarStyle?: Styles.StylesCrossPlatform
  children: React.ReactNode
  containerStyle?: Styles.StylesCrossPlatform
  // Header props, only applies on mobile. backButtonType === 'back' renders back button on desktop
  accountName?: string
  backButtonType: 'back' | 'cancel' | 'close' // 'back' -> '<' ; 'cancel' -> 'Cancel' ; 'close' -> 'Close'
  headerStyle?: Styles.StylesCrossPlatform
  headerTitle?: string
  safeAreaViewBottomStyle?: Styles.StylesCrossPlatform
  safeAreaViewTopStyle?: Styles.StylesCrossPlatform
}

const backButtonTypeToFcnHandle = {
  back: 'onBack', // Displays back button on desktop
  cancel: 'onCancel',
  close: 'onCancel',
}

const WalletPopup = (props: WalletPopupProps) => (
  <Kb.Box2 direction="vertical" style={styles.outerContainer}>
    <Kb.ScrollView
      alwaysBounceVertical={false}
      style={styles.scrollView}
      contentContainerStyle={styles.scrollViewContentContainer}
    >
      <Kb.Box2
        direction="vertical"
        fullHeight={!Styles.isMobile}
        fullWidth={true}
        centerChildren={true}
        style={Styles.collapseStyles([
          styles.container,
          props.backButtonType === 'back' && !Styles.isMobile ? {paddingTop: Styles.globalMargins.small} : {},
          props.containerStyle,
        ])}
      >
        {props.children}
        {props.bottomButtons && props.bottomButtons.length > 0 && (
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
  buttonBar: Styles.platformStyles({
    isElectron: {
      minHeight: 0,
    },
  }),
  buttonBarContainer: Styles.platformStyles({
    isElectron: {flex: 1, justifyContent: 'flex-end'},
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  container: Styles.platformStyles({
    common: {
      flexGrow: 1,
    },
    isElectron: {
      borderRadius: 'inherit',
      paddingBottom: Styles.globalMargins.xlarge,
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.xlarge,
      textAlign: 'center',
    },
    isMobile: {},
  }),
  header: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
    },
  }),
  outerContainer: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      height: 560,
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
  popup: Styles.platformStyles({isElectron: {height: '560px', overflow: 'hidden'}}),
  scrollView: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    width: '100%',
  },
  scrollViewContentContainer: {...Styles.globalStyles.flexBoxColumn, flexGrow: 1},
})

export default compose(
  withProps((props: WalletPopupProps) => ({
    [backButtonTypeToFcnHandle[props.backButtonType]]: props.onExit,
    customCancelText: props.backButtonType === 'close' ? 'Close' : '',
    customComponent: props.headerTitle && (
      <AccountPageHeader accountName={props.accountName} title={props.headerTitle} />
    ),
    customSafeAreaBottomStyle: props.safeAreaViewBottomStyle,
    customSafeAreaTopStyle: props.safeAreaViewTopStyle,
    style: styles.popup,
  })),
  Kb.HeaderOrPopupWithHeader
  // @ts-ignore
)(WalletPopup) as any
