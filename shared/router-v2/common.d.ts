import type * as React from 'react'
import type {NavigationContainerRef} from '@react-navigation/core'
import type {NavState} from '@/constants/router2'
import type * as Styles from '@/styles'
import type {HeaderOptions} from '@react-navigation/elements'
export const tabBarStyle: Styles.StylesCrossPlatform
export const headerDefaultStyle: Styles.StylesCrossPlatform
export const defaultNavigationOptions: {
  header?: (p: unknown) => React.JSX.Element
  headerBackTitle?: string
  headerBackVisible?: boolean
  headerBackgroundContainerStyle?: Styles.StylesCrossPlatform
  headerLeft?: HeaderOptions['headerLeft']
  headerLeftContainerStyle?: Styles.StylesCrossPlatform
  headerRightContainerStyle?: Styles.StylesCrossPlatform
  headerStyle?: Styles.StylesCrossPlatform
  headerTitle?: HeaderOptions['headerTitle']
  headerTitleContainerStyle?: Styles.StylesCrossPlatform
}

export function useSubnavTabAction(
  navigation: NavigationContainerRef<{}>,
  state: NavState
): (t: string) => void
