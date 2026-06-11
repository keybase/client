import {
  CommonActions,
  type NavigationProp,
  type NavigationState,
  type ParamListBase,
} from '@react-navigation/native'

type Navigation = {
  dispatch: NavigationProp<ParamListBase>['dispatch']
  getState: () => Readonly<NavigationState> | undefined
}

const setRouteParamsIfPresent = (navigation: Navigation, routeName: string, params: object) => {
  const routes = navigation.getState()?.routes
  const route = routes ? [...routes].reverse().find(r => r.name === routeName) : undefined
  if (!route?.key) {
    return
  }
  navigation.dispatch({
    ...CommonActions.setParams(params),
    source: route.key,
  })
}

export default setRouteParamsIfPresent
