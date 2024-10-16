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
  const routesRef = React.useRef(state?.routes)
  const stateKeyRef = React.useRef(state?.key)
  React.useEffect(() => {
    routesRef.current = state?.routes
    stateKeyRef.current = state?.key
  }, [state])

  const navRef = React.useRef(navigation)
  React.useEffect(() => {
    navRef.current = navigation
  }, [navigation])

  const onSelectTab = React.useCallback((tab: string) => {
    const r = routesRef.current?.find((r: {name?: string; key?: string}) => {
      return r.name === tab
    })

    const key = r?.key ?? ''
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
