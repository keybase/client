import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {isTablet, isIOS} from '@/constants/platform'
import type {GetOptions, GetOptionsParams} from '@/constants/types/router'

const modalOffset = isIOS ? 40 : 0

type LayoutProps = {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}

const TabScreenWrapper = ({children}: {children: React.ReactNode}) => {
  const paddingBottom = useBottomTabBarHeight()
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([styles.tabScreen, {paddingBottom}])}
    >
      {children}
    </Kb.Box2>
  )
}

export const makeLayout = (isModal: boolean, isLoggedOut: boolean, getOptions?: GetOptions) => {
  return function Layout({children, route, navigation}: LayoutProps) {
    const navigationOptions = typeof getOptions === 'function' ? getOptions({navigation, route}) : getOptions
    const {modalFooter} = navigationOptions ?? {}

    const suspenseContent = <React.Suspense>{children}</React.Suspense>

    const wrappedContent = modalFooter ? (
      <>
        {suspenseContent}
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          fullWidth={true}
          style={Kb.Styles.collapseStyles([
            modalFooter.hideBorder ? styles.modalFooterNoBorder : styles.modalFooter,
            modalFooter.style,
          ])}
        >
          {modalFooter.content}
        </Kb.Box2>
      </>
    ) : (
      suspenseContent
    )

    if (!isModal && !isLoggedOut) {
      return <TabScreenWrapper>{wrappedContent}</TabScreenWrapper>
    }

    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
        <Kb.KeyboardAvoidingView2 extraOffset={modalOffset} compensateNotBeingOnBottom={isModal && isTablet}>
          <Kb.SafeAreaView
            style={Kb.Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
          >
            {wrappedContent}
          </Kb.SafeAreaView>
        </Kb.KeyboardAvoidingView2>
      </SafeAreaProvider>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
      }),
      modalFooterNoBorder: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          minHeight: 56,
        },
      }),
      tabScreen: {
        flex: 1,
      },
    }) as const
)
