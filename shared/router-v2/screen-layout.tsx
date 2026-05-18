import * as Kb from '@/common-adapters'
import * as React from 'react'
import {isTablet} from '@/constants/platform'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import type {GetOptions, GetOptionsParams, GetOptionsRet} from '@/constants/types/router'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {ParamListBase} from '@react-navigation/native'
import {SafeAreaView as RNScreensSafeAreaView} from 'react-native-screens/experimental'

type ModalWrapperProps = {
  children: React.ReactNode
  navigationOptions?: GetOptionsRet
  navigation: NativeStackNavigationProp<ParamListBase>
}

type LayoutProps = {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}

// Native-only wrapper components

const TabScreenWrapper = ({children}: {children: React.ReactNode}) => {
  if (isAndroid) {
    return (
      <RNScreensSafeAreaView edges={{bottom: true}} style={styles.tabScreen}>
        {children}
      </RNScreensSafeAreaView>
    )
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tabScreen}>
      {children}
    </Kb.Box2>
  )
}

const StackScreenWrapper = ({children}: {children: React.ReactNode}) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tabScreen}>
    {children}
  </Kb.Box2>
)

const desktopMakeLayout = (
  isModal: boolean,
  _isLoggedOut: boolean,
  _isTabScreen: boolean,
  getOptions?: GetOptions
) => {
  return ({children, route, navigation}: LayoutProps) => {
    const {ModalWrapper} = require('./screen-layout-modal.desktop') as {
      ModalWrapper: React.ComponentType<ModalWrapperProps>
    }
    const navigationOptions: GetOptionsRet | undefined =
      typeof getOptions === 'function' ? getOptions({navigation, route}) : getOptions

    let body = children

    if (isModal) {
      body = (
        <ModalWrapper navigation={navigation} navigationOptions={navigationOptions}>
          {body}
        </ModalWrapper>
      )
    }

    body = <React.Suspense>{body}</React.Suspense>
    body = <React.StrictMode>{body}</React.StrictMode>

    return body
  }
}

const nativeMakeLayout = (
  isModal: boolean,
  isLoggedOut: boolean,
  isTabScreen: boolean,
  getOptions?: GetOptions
) => {
  const modalOffset = isIOS ? 40 : 0
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

    if (!isModal && !isLoggedOut && isTabScreen) {
      return <TabScreenWrapper>{wrappedContent}</TabScreenWrapper>
    }
    if (!isModal && !isLoggedOut) {
      return <StackScreenWrapper>{wrappedContent}</StackScreenWrapper>
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

export const makeLayout = isMobile ? nativeMakeLayout : desktopMakeLayout

const styles = Kb.Styles.styleSheetCreate(() => ({
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
}))
