import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import Header from './header/index.desktop'
import {HeaderLeftArrow} from '../common-adapters/header-hoc'
import {TabActions} from '@react-navigation/core'
import type {useSubnavTabAction as useSubnavTabActionType} from './common'

export const headerDefaultStyle = {}
export const tabBarStyle = {
  get backgroundColor() {
    return Styles.globalColors.blueDarkOrGreyDarkest
  },
}
export const TabletWrapper = (p: {children: React.ReactNode}) => p.children
const actionWidth = 64
export const defaultNavigationOptions = {
  header: (p: any) => <Header {...p} />,
  headerBackTitle: 'temp',
  headerBackVisible: true,
  headerLeft: (p: any) => <HeaderLeftArrow {...p} />,
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

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {
    alignSelf: 'center',
    color: Styles.globalColors.black,
    marginLeft: Styles.globalMargins.xsmall,
  },
}))

export const useSubnavTabAction: typeof useSubnavTabActionType = (navigation, state) => {
  const routeKeyMapRef = React.useRef(new Map<string, string>())
  routeKeyMapRef.current = new Map(
    state?.routes?.map((r: {name?: string; key?: string}) => {
      return [r.name ?? '', r.key ?? ''] as const
    }) ?? new Array<[string, string]>()
  )

  const stateKeyRef = React.useRef<string | undefined>()
  stateKeyRef.current = state?.key

  const navRef = React.useRef(navigation)
  navRef.current = navigation

  const onSelectTab = React.useCallback((tab: string) => {
    // @ts-ignore
    const key = routeKeyMapRef.current.get(tab)
    const event = key
      ? navRef.current.emit({
          canPreventDefault: true,
          target: key,
          // @ts-ignore
          type: 'tabPress',
        })
      : {defaultPrevented: false}

    if (!event.defaultPrevented) {
      navRef.current.dispatch({
        ...TabActions.jumpTo(tab),
        target: stateKeyRef.current,
      })
    }
  }, [])

  return onSelectTab
}
