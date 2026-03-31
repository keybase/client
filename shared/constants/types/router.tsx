import type * as Styles from '@/styles'
import type {NativeStackNavigationProp, NativeStackNavigationOptions} from '@react-navigation/native-stack'
import type {ParamListBase, RouteProp} from '@react-navigation/native'
import type {HeaderBackButtonProps} from '@react-navigation/elements'

type RouteNameFor<ParamList extends ParamListBase> = Extract<keyof ParamList, string>

export type GetOptionsParams<
  ParamList extends ParamListBase = ParamListBase,
  RouteName extends RouteNameFor<ParamList> = RouteNameFor<ParamList>,
> = {
  navigation: NativeStackNavigationProp<ParamList, RouteName>
  route: RouteProp<ParamList, RouteName>
}

// Type for screen components that receive navigation props
export type ScreenProps<
  ParamList extends ParamListBase = ParamListBase,
  RouteName extends RouteNameFor<ParamList> = RouteNameFor<ParamList>,
> = {
  navigation: NativeStackNavigationProp<ParamList, RouteName>
  route: RouteProp<ParamList, RouteName>
}

export type ScreenComponentProps<
  ParamList extends ParamListBase = ParamListBase,
  RouteName extends RouteNameFor<ParamList> = RouteNameFor<ParamList>,
> = {
  route: RouteProp<ParamList, RouteName>
  navigation: NativeStackNavigationProp<ParamList, RouteName>
}
// Properties consumed by our layout functions (not React Navigation)
export type LayoutOptions = {
  safeAreaStyle?: Styles.StylesCrossPlatform
  overlayStyle?: Styles.StylesCrossPlatform
  overlayAvoidTabs?: boolean
  overlayTransparent?: boolean
  overlayNoClose?: boolean
  modalStyle?: Styles.StylesCrossPlatform
  modalHeader?: {
    title?: React.ReactNode
    leftButton?: React.ReactNode
    rightButton?: React.ReactNode
    subTitle?: React.ReactNode
    hideBorder?: boolean
    icon?: React.ReactNode
    style?: Styles.StylesCrossPlatform
  }
  modalFooter?: {
    content: React.ReactNode
    hideBorder?: boolean
    style?: Styles.StylesCrossPlatform
  }
  headerBottomStyle?: Styles.StylesCrossPlatform
  headerRightActions?: (p: HeaderBackButtonProps) => React.ReactNode
}

// NativeStackNavigationOptions is the source of truth. We extend it with:
// - LayoutOptions: custom properties consumed by our layout wrappers (stripped before passing to RN)
// - headerStyle override: RN types this narrowly as {backgroundColor?: string} but our custom
//   header supports full style objects
// - Header container styles: @react-navigation/elements HeaderOptions that work at runtime
//   through our custom header but aren't exposed in NativeStackNavigationOptions
export type GetOptionsRet =
  | (Omit<NativeStackNavigationOptions, 'headerStyle'> &
      LayoutOptions & {
        headerStyle?: Styles.StylesCrossPlatform
        headerBackgroundContainerStyle?: Styles.StylesCrossPlatform
        headerLeftContainerStyle?: Styles.StylesCrossPlatform
        headerRightContainerStyle?: Styles.StylesCrossPlatform
        headerTitleContainerStyle?: Styles.StylesCrossPlatform
      })
  | undefined

type AnyScreen = React.ComponentType<any>

export type GetOptions<Screen extends AnyScreen = AnyScreen> =
  | GetOptionsRet
  | ((p: React.ComponentProps<Screen>) => GetOptionsRet)

export type RouteDef<Screen extends AnyScreen = AnyScreen> = {
  getOptions?: GetOptions<Screen>
  screen: Screen
}
export type RouteMap = {[K in string]?: RouteDef}

type RouteDefMatchesScreen<R> = R extends {screen: infer Screen}
  ? Screen extends AnyScreen
    ? Omit<R, 'getOptions' | 'screen'> & {
        getOptions?: GetOptions<Screen>
        screen: Screen
      }
    : never
  : never

export const defineRouteMap = <const Routes extends Record<string, {screen: AnyScreen}>>(routes: {
  [K in keyof Routes]: RouteDefMatchesScreen<Routes[K]>
}) => routes
