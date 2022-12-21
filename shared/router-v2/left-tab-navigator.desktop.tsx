import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import TabBar from './tab-bar.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'

type BackBehavior = Parameters<typeof TabRouter>[0]['backBehavior']
type Props = Parameters<typeof useNavigationBuilder>[1] & {backBehavior: BackBehavior}
type Route = ReturnType<typeof useNavigationBuilder>['state']['routes'][0]
type Desc = ReturnType<typeof useNavigationBuilder>['descriptors'][0]

const RouteBox = React.memo(function RouteBox(p: {
  shouldRender: (key: string, selected: boolean) => boolean
  route: Route
  selected: boolean
  desc: Desc
}) {
  const {shouldRender, selected, route, desc} = p
  return (
    <Kb.Box2
      key={route.key}
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={selected ? undefined : styles.hidden}
    >
      {shouldRender(route.key, selected) ? desc.render() : null}
    </Kb.Box2>
  )
})

const LeftTabNavigator = React.memo(function LeftTabNavigator({
  backBehavior,
  initialRouteName,
  children,
  screenOptions,
}: Props) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    initialRouteName,
    screenOptions,
  })

  const renderedRef = React.useRef<{[key: string]: boolean}>({})
  // render if its been rendered before
  const shouldRender = React.useCallback(
    (key: string, selected: boolean) => {
      if (renderedRef.current[key]) {
        return true
      }
      if (selected) {
        renderedRef.current[key] = true
        return true
      }
      return false
    },
    [renderedRef]
  )

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <TabBar state={state} navigation={navigation} />
        <Kb.BoxGrow>
          {state.routes.map((route, i) => (
            <RouteBox
              shouldRender={shouldRender}
              key={route.name}
              selected={i === state.index}
              route={route}
              desc={descriptors[route.key]}
            />
          ))}
        </Kb.BoxGrow>
      </Kb.Box2>
    </NavigationContent>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Styles.globalColors.white},
  hidden: {display: 'none'},
}))

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
