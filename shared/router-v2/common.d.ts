import type {NavState} from '@/constants/router'
import type {ParamListBase} from '@react-navigation/native'
import type {NavigationContainerRef} from '@react-navigation/core'
import type * as Styles from '@/styles'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
export const tabBarStyle: Styles.StylesCrossPlatform
export const tabBarBlurEffect: 'systemDefault'
export const tabBarMinimizeBehavior: 'onScrollDown'
export const headerDefaultStyle: Styles.StylesCrossPlatform
// Intersection with NativeStackNavigationOptions: our custom header reads container
// styles that aren't in RN's native-stack types. Cast to NativeStackNavigationOptions
// at the boundary when passing to createNativeStackNavigator.
export const defaultNavigationOptions: NativeStackNavigationOptions & {
  headerBackgroundContainerStyle?: Styles.StylesCrossPlatform
  headerLeftContainerStyle?: Styles.StylesCrossPlatform
  headerRightContainerStyle?: Styles.StylesCrossPlatform
  headerTitleContainerStyle?: Styles.StylesCrossPlatform
}

type SubnavNavigation = Pick<NavigationContainerRef<ParamListBase>, 'dispatch' | 'emit'>

export function useSubnavTabAction(
  navigation: SubnavNavigation,
  state: NavState
): (t: string) => void
