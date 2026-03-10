import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {isTablet, isIOS} from '@/constants/platform'
import {ModalHeader, ModalFooter} from '@/common-adapters/modal2'
import type {GetOptions, GetOptionsParams} from '@/constants/types/router'

const modalOffset = isIOS ? 40 : 0

type LayoutProps = {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}

export const makeLayout = (isModal: boolean, isLoggedOut: boolean, getOptions?: GetOptions) => {
  return function Layout({children, route, navigation}: LayoutProps) {
    const navigationOptions = typeof getOptions === 'function' ? getOptions({navigation, route}) : getOptions
    const {modal2Footer} = navigationOptions ?? {}

    // Build header from standard React Navigation options (modal screens only —
    // non-modal screens use React Navigation's native header)
    let hasHeader = false
    let titleNode: React.ReactNode = undefined
    let leftNode: React.ReactNode = undefined
    let rightNode: React.ReactNode = undefined
    if (isModal) {
      const headerTitle = navigationOptions?.['headerTitle'] ?? navigationOptions?.['title']
      const headerLeft = navigationOptions?.['headerLeft']
      const headerRight = navigationOptions?.['headerRight']
      const headerShown = navigationOptions?.['headerShown'] !== false
      hasHeader = headerShown && !!(headerTitle || headerLeft || headerRight)

      titleNode = typeof headerTitle === 'function'
        ? headerTitle({children: typeof navigationOptions?.['title'] === 'string' ? navigationOptions['title'] : '', tintColor: ''})
        : headerTitle
      leftNode = typeof headerLeft === 'function' ? headerLeft({canGoBack: true}) : undefined
      rightNode = typeof headerRight === 'function' ? headerRight({tintColor: ''}) : undefined
    }

    const suspenseContent = <React.Suspense>{children}</React.Suspense>

    const wrappedContent = hasHeader || modal2Footer ? (
      <>
        {hasHeader ? <ModalHeader title={titleNode} leftButton={leftNode} rightButton={rightNode} /> : null}
        {suspenseContent}
        {modal2Footer ? <ModalFooter {...modal2Footer} wide={false} fullscreen={false} /> : null}
      </>
    ) : suspenseContent

    if (!isModal && !isLoggedOut) {
      return wrappedContent
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
    }) as const
)
