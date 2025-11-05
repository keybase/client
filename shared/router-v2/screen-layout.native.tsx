import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {isTablet, isIOS} from '@/constants/platform'
import type {GetOptions, GetOptionsParams} from '@/constants/types/router2'

const modalOffset = isIOS ? 40 : 0

type LayoutProps = {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}

export const makeLayout = (isModal: boolean, isLoggedOut: boolean, getOptions?: GetOptions) => {
  return ({children, route, navigation}: LayoutProps) => {
    const navigationOptions =
      typeof getOptions === 'function'
        ? getOptions({navigation, route})
        : getOptions

    const suspenseContent = (
      <React.Suspense
        fallback={
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
            <Kb.ProgressIndicator type="Large" />
          </Kb.Box2>
        }
      >
        {children}
      </React.Suspense>
    )

    if (!isModal && !isLoggedOut) {
      return suspenseContent
    }

    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
        <Kb.KeyboardAvoidingView2 extraOffset={modalOffset} compensateNotBeingOnBottom={isModal && isTablet}>
          <Kb.SafeAreaView
            style={Kb.Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
          >
            {suspenseContent}
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

