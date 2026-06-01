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
      {!!props.safeAreaViewTopStyle && isMobile && (
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
            fullHeight={!isMobile}
            fullWidth={true}
            centerChildren={true}
            style={Kb.Styles.collapseStyles([styles.container, props.containerStyle])}
          >
            {props.children}
            {props.bottomButtons && props.bottomButtons.length > 0 && (
              <Kb.Box2 direction="vertical" style={styles.buttonBarContainer} fullWidth={true}>
                <Kb.ButtonBar
                  direction={props.buttonBarDirection || (isMobile ? 'column' : 'row')}
                  fullWidth={isMobile}
                  style={Kb.Styles.collapseStyles([styles.buttonBar, props.buttonBarStyle])}
                >
                  {props.bottomButtons}
                </Kb.ButtonBar>
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
      {!!props.safeAreaViewBottomStyle && isMobile && (
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
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    },
  }),
  container: Kb.Styles.platformStyles({
    common: {
      flexGrow: 1,
    },
    isElectron: {
      borderRadius: 'inherit',
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xlarge, Kb.Styles.globalMargins.medium),
      textAlign: 'center',
    },
    isMobile: {},
  }),
  outerContainer: Kb.Styles.platformStyles({
    isElectron: {
      borderRadius: Kb.Styles.borderRadius,
      height: 560,
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
  scrollView: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    ...Kb.Styles.globalStyles.flexGrow,
    ...Kb.Styles.size('100%'),
  },
  scrollViewContentContainer: {...Kb.Styles.globalStyles.flexBoxColumn, ...Kb.Styles.globalStyles.flexGrow},
}))

export const walletModalIconStyle = Kb.Styles.platformStyles({
  common: {marginBottom: Kb.Styles.globalMargins.large},
  isElectron: {marginTop: Kb.Styles.globalMargins.medium},
  isMobile: {marginTop: Kb.Styles.globalMargins.xlarge},
})

export default WalletPopup
