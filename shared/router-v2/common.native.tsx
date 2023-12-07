import * as React from 'react'
import * as Kb from '@/common-adapters'
import {TabActions, type NavigationContainerRef} from '@react-navigation/core'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
import {HeaderLeftArrow} from '@/common-adapters/header-hoc'
import type {NavState} from '@/constants/router2'

export const headerDefaultStyle = {
  get backgroundColor() {
    return Kb.Styles.isIOS ? Kb.Styles.globalColors.fastBlank : Kb.Styles.globalColors.white
  },
  borderBottomColor: Kb.Styles.globalColors.black_10,
  borderBottomWidth: Kb.Styles.hairlineWidth,
  height: 44,
}

export const tabBarStyle = {
  get backgroundColor() {
    return Kb.Styles.globalColors.blueDarkOrGreyDarkest
  },
}

export const tabBarStyleHidden = {
  display: 'none',
} as const

const actionWidth = 64
const DEBUGCOLORS = __DEV__ && (false as boolean)

// Options used by default on all navigators
export const defaultNavigationOptions = {
  headerBackTitle: '',
  headerBackVisible: false,
  headerBackgroundContainerStyle: {
    flexShrink: 0,
    ...(DEBUGCOLORS ? {backgroundColor: 'pink'} : {}),
  },
  headerLeft: ({canGoBack, onPress, tintColor}: HeaderBackButtonProps) => (
    <HeaderLeftArrow canGoBack={canGoBack} onPress={onPress} tintColor={tintColor} />
  ),
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
  headerTitle: (hp: {children: React.ReactNode}) => (
    <Kb.Text type="BodyBig" style={styles.headerTitle} lineClamp={1} center={true}>
      {hp.children}
    </Kb.Text>
  ),
  headerTitleAlign: Kb.Styles.isAndroid ? 'center' : undefined,
  headerTitleContainerStyle: {
    alignItems: 'stretch',
    flexGrow: 1,
    flexShrink: 0,
    // https://github.com/react-navigation/react-navigation/blob/main/packages/elements/src/Header/Header.tsx#L254
    // doesn't take into account custom sizes
    maxWidth: Kb.Styles.dimensionWidth - 16 * 2 - actionWidth * 2,
    minHeight: 44,
    ...(DEBUGCOLORS ? {backgroundColor: 'cyan'} : {}),
  },
} as const

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerTitle: {
    color: Kb.Styles.globalColors.black,
    ...(DEBUGCOLORS ? {backgroundColor: 'pink'} : {}),
  },
}))

export const useSubnavTabAction = (navigation: NavigationContainerRef<{}>, state: NavState) =>
  React.useCallback(
    (tab: string) => {
      const route = state?.routes?.find(r => r.name === tab)
      const event = route
        ? navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress',
          } as any)
        : {defaultPrevented: false}

      if (!event.defaultPrevented) {
        navigation.dispatch({
          ...TabActions.jumpTo(tab),
          target: state?.key,
        })
      }
    },
    [navigation, state]
  )
