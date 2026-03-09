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
    const {modal2Header, modal2Footer} = navigationOptions ?? {}

    const suspenseContent = <React.Suspense>{children}</React.Suspense>

    const wrappedContent = modal2Header || modal2Footer ? (
      <>
        {modal2Header ? <ModalHeader {...modal2Header} /> : null}
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
