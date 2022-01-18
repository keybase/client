import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import {TabActions} from '@react-navigation/core'
import {HeaderLeftArrow} from '../common-adapters/header-hoc'

export const headerDefaultStyle = {
  get backgroundColor() {
    return Styles.globalColors.fastBlank
  },
}
const actionWidth = 64
const DEBUGCOLORS = __DEV__ && false

// Options used by default on all navigators
export const defaultNavigationOptions: any = {
  headerBackTitle: 'temp',
  headerBackVisible: true,
  headerLeft: ({canGoBack, onPress, tintColor}) => (
    <HeaderLeftArrow canGoBack={canGoBack} onPress={onPress} tintColor={tintColor} />
  ),
  headerLeftContainerStyle: {
    paddingLeft: 8,
    width: actionWidth,
    ...(DEBUGCOLORS ? {backgroundColor: 'yellow'} : {}),
  },
  headerRightContainerStyle: {
    paddingRight: 8,
    width: actionWidth,
    ...(DEBUGCOLORS ? {backgroundColor: 'orange'} : {}),
  },
  headerStyle: headerDefaultStyle,
  headerTitle: (hp: any) => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1} center={true}>
      {hp.children}
    </Kb.Text>
  ),
  headerTitleContainerStyle: {
    alignItems: 'stretch',
    flexGrow: 1,
    ...(DEBUGCOLORS ? {backgroundColor: 'red'} : {}),
  },
}

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {
    color: Styles.globalColors.black,
    ...(DEBUGCOLORS ? {backgroundColor: 'pink'} : {}),
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
