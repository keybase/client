import * as React from 'react'
import * as Styles from '../styles'
import Header from './header/index.desktop'
import * as Kb from '../common-adapters'
import {HeaderLeftArrow} from '../common-adapters/header-hoc'
import {TabActions} from '@react-navigation/core'

export const headerDefaultStyle = {
  height: 80,
}
export const tabBarStyle = {
  get backgroundColor() {
    return Styles.globalColors.blueDarkOrGreyDarkest
  },
}
const actionWidth = 64
export const defaultNavigationOptions: any = {
  header: (p: any) => <Header {...p} />,
  headerBackTitle: 'temp',
  headerBackVisible: true,
  headerLeft: HeaderLeftArrow,
  headerLeftContainerStyle: {
    paddingLeft: 8,
    width: actionWidth,
  },
  headerRightContainerStyle: {paddingRight: 8},
  headerStyle: headerDefaultStyle,
  headerTitle: (hp: any) => (
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

export const useSubnavTabAction = (navigation, state) =>
  React.useCallback(
    (tab: string) => {
      const route = state.routes.find(r => r.name === tab)
      const event = route
        ? navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          })
        : {}

      if (!event.defaultPrevented) {
        navigation.dispatch({
          ...TabActions.jumpTo(tab),
          target: state.key,
        })
      }
    },
    [navigation, state]
  )
