import type * as Styles from '@/styles'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {NativeStackNavigationProp, NativeStackNavigationOptions} from '@react-navigation/native-stack'
import type {RouteProp} from '@react-navigation/native'
import type {HeaderBackButtonProps} from '@react-navigation/elements'

export type GetOptionsParams<RouteName extends keyof KBRootParamList = keyof KBRootParamList> = {
  navigation: NativeStackNavigationProp<KBRootParamList, RouteName>
  route: RouteProp<KBRootParamList, RouteName>
}

// Type for screen components that receive navigation props
export type ScreenProps<RouteName extends keyof KBRootParamList = keyof KBRootParamList> = {
  navigation: NativeStackNavigationProp<KBRootParamList, RouteName>
  route: RouteProp<KBRootParamList, RouteName>
}

export type ScreenComponentProps = {
  route: {params: any}
  navigation: NativeStackNavigationProp<KBRootParamList>
}
// Properties consumed by our layout functions (not React Navigation)
export type LayoutOptions = {
  safeAreaStyle?: Styles.StylesCrossPlatform
  modal2Style?: Styles.StylesCrossPlatform
  modal2AvoidTabs?: boolean
  modal2?: boolean
  modal2ClearCover?: boolean
  modal2NoClose?: boolean
  modal2Header?: {
    title?: React.ReactNode
    leftButton?: React.ReactNode
    rightButton?: React.ReactNode
    subTitle?: React.ReactNode
    hideBorder?: boolean
    icon?: React.ReactNode
    style?: Styles.StylesCrossPlatform
  }
  modal2Footer?: {
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

export type GetOptions = GetOptionsRet | ((p: any) => GetOptionsRet)
export type RouteDef = {
  getOptions?: GetOptions
  screen: React.ComponentType<ScreenComponentProps>
}
export type RouteMap = {[K in string]?: RouteDef}
