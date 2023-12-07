import * as React from 'react'
import * as Kb from '@/common-adapters'
import Header from './header/index.desktop'
import {HeaderLeftArrow} from '@/common-adapters/header-hoc'
import {TabActions} from '@react-navigation/core'
import type {useSubnavTabAction as useSubnavTabActionType} from './common'

export const headerDefaultStyle = {}
export const tabBarStyle = {
  get backgroundColor() {
    return Kb.Styles.globalColors.blueDarkOrGreyDarkest
  },
}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerTitle: {
    alignSelf: 'center',
    color: Kb.Styles.globalColors.black,
    marginLeft: Kb.Styles.globalMargins.xsmall,
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
    const key = routeKeyMapRef.current.get(tab)
    const event = key
      ? navRef.current.emit({
          canPreventDefault: true,
          target: key,
          type: 'tabPress',
        } as any)
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
