import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import Header from './header/index.desktop'
import {HeaderLeftArrow} from '../common-adapters/header-hoc'
import {TabActions} from '@react-navigation/core'
import type {useSubnavTabAction as useSubnavTabActionType} from './common'

export const headerDefaultStyle = {
  height: 80,
}
export const tabBarStyle = {
  get backgroundColor() {
    return Styles.globalColors.blueDarkOrGreyDarkest
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
    alignItems: 'stretch',
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

export const useSubnavTabAction: typeof useSubnavTabActionType = (navigation, state) =>
  React.useCallback(
    (tab: string) => {
      // @ts-ignore
      const route = state?.routes?.find(r => r.name === tab)
      const event: any = route
        ? navigation.emit({
            canPreventDefault: true,
            target: route?.key,
            // @ts-ignore
            type: 'tabPress',
          })
        : {}

      if (!event.defaultPrevented) {
        navigation.dispatch({
          ...TabActions.jumpTo(tab),
          target: state?.key,
        })
      }
    },
    [navigation, state]
  )
