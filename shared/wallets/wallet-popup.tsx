import type * as React from 'react'
import * as Kb from '@/common-adapters'

// WalletPopup - wraps all stellar modals except for the send / request forms.

type WalletPopupProps = {
  // Buttons to be placed in the bottom Button Bar.
  // If none are included, the bar is not rendered.
  bottomButtons?: Array<React.ReactNode>
  buttonBarDirection?: 'column' | 'row'
  buttonBarStyle?: Kb.Styles.StylesCrossPlatform
  children: React.ReactNode
  containerStyle?: Kb.Styles.StylesCrossPlatform
  safeAreaViewBottomStyle?: Kb.Styles.StylesCrossPlatform
  safeAreaViewTopStyle?: Kb.Styles.StylesCrossPlatform
}

const WalletPopup = (props: WalletPopupProps) => {
  return (
    <>
      {!!props.safeAreaViewTopStyle && Kb.Styles.isMobile && (
        <Kb.SafeAreaViewTop style={props.safeAreaViewTopStyle} />
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
            style={Kb.Styles.collapseStyles([styles.container, props.containerStyle])}
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
      {!!props.safeAreaViewBottomStyle && Kb.Styles.isMobile && (
        <Kb.SafeAreaView style={props.safeAreaViewBottomStyle} />
      )}
    </>
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
  scrollView: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    height: '100%',
    width: '100%',
  },
  scrollViewContentContainer: {...Kb.Styles.globalStyles.flexBoxColumn, flexGrow: 1},
}))

export default WalletPopup
