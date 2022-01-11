import * as React from 'react'
import * as Styles from '../styles'
import Header from './header/index.desktop'
import * as Kb from '../common-adapters'
import {HeaderLeftArrow} from '../common-adapters/header-hoc'
import {TabActions} from '@react-navigation/core'

export const headerDefaultStyle = {
  height: 80,
}
const actionWidth = 64
export const defaultNavigationOptions: any = {
  header: (p: any) => <Header {...p} />,
  headerLeft: HeaderLeftArrow,
  headerStyle: headerDefaultStyle,
  headerTitleContainerStyle: {
    alignItems: 'stretch',
    flexGrow: 1,
  },
  headerBackTitle: 'temp',
  headerBackVisible: true,
  headerRightContainerStyle: {
    paddingRight: 8,
  },
  headerLeftContainerStyle: {
    paddingLeft: 8,
    width: actionWidth,
  },
  headerTitle: hp => (
    <Kb.Text type="Header" style={styles.headerTitle} lineClamp={1} center={true}>
      {hp.children}
    </Kb.Text>
  ),
}

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {
    color: Styles.globalColors.black,
    alignSelf: 'center',
    marginLeft: Styles.globalMargins.xsmall,
  },
}))

export const useSubnavTabAction = (navigation, state) =>
  React.useCallback(
    (tab: string) => {
      const route = state.routes.find(r => r.name === tab)
      const event = route
        ? navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
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
