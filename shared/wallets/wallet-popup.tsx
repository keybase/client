import * as React from 'react'
import * as Kb from '@/common-adapters'
import AccountPageHeader from './account-page-header'

// WalletPopup - wraps all stellar modals except for the send / request forms.
//
// Handles platform split between desktop modal / native screen + header

type WalletPopupProps = {
  onCancel?: () => void
  onExit?: () => void // called onExit so to avoid name conflict with other header props
  // Buttons to be placed in the bottom Button Bar.
  // If none are included, the bar is not rendered.
  bottomButtons?: Array<React.ReactNode>
  buttonBarDirection?: 'column' | 'row'
  buttonBarStyle?: Kb.Styles.StylesCrossPlatform
  children: React.ReactNode
  containerStyle?: Kb.Styles.StylesCrossPlatform
  // Header props, only applies on mobile. backButtonType === 'back' renders back button on desktop
  accountName?: string
  backButtonType: 'back' | 'cancel' | 'close' // 'back' -> '<' ; 'cancel' -> 'Cancel' ; 'close' -> 'Close'
  headerStyle?: Kb.Styles.StylesCrossPlatform
  headerTitle?: string
  safeAreaViewBottomStyle?: Kb.Styles.StylesCrossPlatform
  safeAreaViewTopStyle?: Kb.Styles.StylesCrossPlatform
}

const WalletPopup = (props: WalletPopupProps) => {
  const onBack = props.backButtonType === 'back' ? props.onExit : undefined // Displays back button on desktop
  return (
    <Kb.PopupWrapper
      customCancelText={props.backButtonType === 'close' ? 'Close' : ''}
      customComponent={
        props.headerTitle && <AccountPageHeader accountName={props.accountName} title={props.headerTitle} />
      }
      customSafeAreaBottomStyle={props.safeAreaViewBottomStyle}
      customSafeAreaTopStyle={props.safeAreaViewTopStyle}
      onCancel={
        props.onCancel ??
        (props.backButtonType === 'cancel' || props.backButtonType === 'close' ? props.onExit : undefined)
      }
      styleClipContainer={styles.popup}
    >
      {onBack && !Kb.Styles.isMobile && (
        <Kb.HeaderHocHeader onBack={onBack} headerStyle={styles.headerStyle} />
      )}
      <Kb.Box2 direction="vertical" style={styles.outerContainer}>
        <Kb.ScrollView
          alwaysBounceVertical={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContentContainer}
        >
          <Kb.Box2
            direction="vertical"
            fullHeight={!Kb.Styles.isMobile}
            fullWidth={true}
            centerChildren={true}
            style={Kb.Styles.collapseStyles([
              styles.container,
              props.backButtonType === 'back' && !Kb.Styles.isMobile
                ? {paddingTop: Kb.Styles.globalMargins.small}
                : {},
              props.containerStyle,
            ])}
          >
            {props.children}
            {props.bottomButtons && props.bottomButtons.length > 0 && (
              <Kb.Box2 direction="vertical" style={styles.buttonBarContainer} fullWidth={true}>
                <Kb.ButtonBar
                  direction={props.buttonBarDirection || (Kb.Styles.isMobile ? 'column' : 'row')}
                  fullWidth={Kb.Styles.isMobile}
                  style={Kb.Styles.collapseStyles([styles.buttonBar, props.buttonBarStyle])}
                >
                  {props.bottomButtons}
                </Kb.ButtonBar>
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: Kb.Styles.platformStyles({
    isElectron: {
      minHeight: 0,
    },
  }),
  buttonBarContainer: Kb.Styles.platformStyles({
    isElectron: {flex: 1, justifyContent: 'flex-end'},
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
  }),
  container: Kb.Styles.platformStyles({
    common: {
      flexGrow: 1,
    },
    isElectron: {
      borderRadius: 'inherit',
      paddingBottom: Kb.Styles.globalMargins.xlarge,
      paddingLeft: Kb.Styles.globalMargins.medium,
      paddingRight: Kb.Styles.globalMargins.medium,
      paddingTop: Kb.Styles.globalMargins.xlarge,
      textAlign: 'center',
    },
    isMobile: {},
  }),
  header: Kb.Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
    },
  }),
  headerStyle: {backgroundColor: Kb.Styles.globalColors.transparent},
  outerContainer: Kb.Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      height: 560,
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
  popup: Kb.Styles.platformStyles({isElectron: {height: '560px', overflow: 'hidden'}}),
  scrollView: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    width: '100%',
  },
  scrollViewContentContainer: {...Kb.Styles.globalStyles.flexBoxColumn, flexGrow: 1},
}))

export default WalletPopup
