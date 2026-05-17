import * as React from 'react'
import * as Kb from '@/common-adapters'
import {TabActions, type NavigationContainerRef} from '@react-navigation/core'
import type {ParamListBase} from '@react-navigation/native'
import type {HeaderOptions} from '@react-navigation/elements'
import type {NativeStackHeaderProps} from '@react-navigation/native-stack'
import {HeaderLeftButton} from '@/common-adapters/header-buttons'
import type {NavState} from '@/constants/router'
import Header from './header/index'

export const headerDefaultStyle = isMobile
  ? {
      get backgroundColor() {
        return isIOS ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.white
      },
      borderBottomColor: Kb.Styles.globalColors.black_10,
      borderBottomWidth: Kb.Styles.hairlineWidth,
      height: 44,
    }
  : {}

export const tabBarStyle = {
  get backgroundColor() {
    return Kb.Styles.globalColors.blueDarkOrGreyDarkest
  },
} as const

export const tabBarBlurEffect = isMobile ? ('systemDefault' as const) : undefined
export const tabBarMinimizeBehavior = isMobile ? ('onScrollDown' as const) : undefined

const actionWidth = 64
const DEBUGCOLORS = __DEV__ && (false as boolean)

type HeaderLeftProps = Parameters<NonNullable<HeaderOptions['headerLeft']>>[0]

export const defaultNavigationOptions = isMobile
  ? ({
      headerBackButtonDisplayMode: 'minimal',
      headerBackTitle: '',
      headerBackVisible: false,
      headerBackgroundContainerStyle: {
        flexShrink: 0,
        ...(DEBUGCOLORS ? {backgroundColor: 'pink'} : {}),
      },
      headerLeft: ({tintColor}: HeaderLeftProps) => {
        return <HeaderLeftButton autoDetectCanGoBack={true} tintColor={tintColor} />
      },
      headerLeftContainerStyle: {
        flexGrow: 0,
        flexShrink: 0,
        maxWidth: actionWidth,
        minWidth: actionWidth,
        paddingLeft: 8,
        width: actionWidth,
        ...(DEBUGCOLORS ? {backgroundColor: 'yellow'} : {}),
      },
      headerRightContainerStyle: {
        flexGrow: 0,
        flexShrink: 0,
        maxWidth: actionWidth,
        minWidth: actionWidth,
        paddingRight: 8,
        width: actionWidth,
        ...(DEBUGCOLORS ? {backgroundColor: 'orange'} : {}),
      },
      headerStyle: headerDefaultStyle,
      headerTintColor: Kb.Styles.globalColors.black_50,
      headerTitle: (hp: {children: React.ReactNode}) => (
        <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1} center={true}>
          {hp.children}
        </Kb.Text>
      ),
      headerTitleAlign: isAndroid ? 'center' : undefined,
      headerTitleContainerStyle: {
        alignItems: 'stretch',
        flexGrow: 1,
        flexShrink: 0,
        maxWidth: Kb.Styles.dimensionWidth - 16 * 2 - actionWidth * 2,
        minHeight: 44,
        ...(DEBUGCOLORS ? {backgroundColor: 'cyan'} : {}),
      },
    } as const)
  : {
      header: (p: NativeStackHeaderProps) => <Header {...(p as any)} />,
      headerBackTitle: 'temp',
      headerBackVisible: true,
      headerLeft: (p: object) => <HeaderLeftButton {...p} />,
      headerLeftContainerStyle: {
        paddingLeft: 8,
        width: actionWidth,
      },
      headerRightContainerStyle: {paddingRight: 8},
      headerStyle: headerDefaultStyle,
      headerTitle: (hp: {children: React.ReactNode}) => (
        <Kb.Text type="Header" style={styles.headerTitle} lineClamp={1} center={true}>
          {hp.children}
        </Kb.Text>
      ),
      headerTitleContainerStyle: {
        alignItems: 'stretch' as const,
        flexGrow: 1,
      },
    }

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerTitle: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.black},
    isElectron: {
      alignSelf: 'center',
      marginLeft: Kb.Styles.globalMargins.xsmall,
    },
    isMobile: {
      ...(DEBUGCOLORS ? {backgroundColor: 'pink'} : {}),
    },
  }),
}))

type SubnavNavigation = Pick<NavigationContainerRef<ParamListBase>, 'dispatch' | 'emit'>

export const useSubnavTabAction = (navigation: SubnavNavigation, state: NavState) => {
  if (!isMobile) {
    const routesRef = {current: state?.routes}
    const stateKeyRef = {current: state?.key}
    const navRef = {current: navigation}

    const onSelectTab = (tab: string) => {
      const r = routesRef.current?.find((r: {name?: string; key?: string}) => {
        return r.name === tab
      })

      const key = r?.key ?? ''
      const event = key
        ? navRef.current.emit({
            canPreventDefault: true,
            target: key,
            // @ts-expect-error tabPress is valid but not in the emit type
            type: 'tabPress',
          })
        : {defaultPrevented: false}

      if (!event.defaultPrevented) {
        navRef.current.dispatch({
          ...TabActions.jumpTo(tab),
          target: stateKeyRef.current,
        })
      }
    }
    return onSelectTab
  }

  const onSelectTab = (tab: string) => {
    const routes = state && 'routes' in state ? state.routes : undefined
    const route = routes?.find((r: {name?: string; key?: string}) => r.name === tab)
    const event = route
      ? navigation.emit({
          canPreventDefault: true,
          target: route.key,
          // @ts-expect-error tabPress is valid but not in the emit type
          type: 'tabPress',
        })
      : {defaultPrevented: false}

    if (!event.defaultPrevented) {
      navigation.dispatch({
        ...TabActions.jumpTo(tab),
        target: state?.key,
      })
    }
  }
  return onSelectTab
}
