import {useNavigation} from '@react-navigation/native'
import type {RootParamList} from '@/router-v2/route-params'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'

// useNavigation() returns GenericNavigation which has setParams/setOptions typed as `unknown`.
// This wrapper infers the route name from the argument and returns a properly typed navigation
// prop, so setParams and setOptions are typed against the actual route params in RootParamList.
export function useTypedNavigation<RouteName extends keyof RootParamList>(
  _routeName: RouteName
): NativeStackNavigationProp<RootParamList, RouteName> {
  return useNavigation() as unknown as NativeStackNavigationProp<RootParamList, RouteName>
}
