import type {RootParamList as KBRootParamList} from './route-params'
import type {PrivateValueStore} from '@react-navigation/core'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs'

// Registers our routes with React Navigation's typed hooks. The PrivateValueStore tuple is
// [ParamList, NavigationList, EventMap, NestedNavigators]: index 0 populates the global
// RootParamList (typed useRoute), index 1 maps each route name to its navigation prop type
// (typed useNavigation('name')). Our navigators are assembled at runtime from route maps, so
// the full static-config type can't be inferred; this hand-built registration covers the same
// surface.
type KBNavigationList = {
  [K in keyof KBRootParamList]: K extends `tabs.${string}`
    ? BottomTabNavigationProp<KBRootParamList, K>
    : NativeStackNavigationProp<KBRootParamList, K>
}

declare module '@react-navigation/core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RootNavigator
    extends PrivateValueStore<[KBRootParamList, KBNavigationList, unknown, unknown]> {}
}

export {}
