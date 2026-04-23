import {CommonActions, type NavigationProp, type ParamListBase} from '@react-navigation/native'

type Navigation = Pick<NavigationProp<ParamListBase>, 'dispatch' | 'getState'>

const setRouteParamsIfPresent = (navigation: Navigation, routeName: string, params: object) => {
  const route = [...navigation.getState().routes].reverse().find(r => r.name === routeName)
  if (!route?.key) {
    return
  }
  navigation.dispatch({
    ...CommonActions.setParams(params),
    source: route.key,
  })
}

export default setRouteParamsIfPresent
