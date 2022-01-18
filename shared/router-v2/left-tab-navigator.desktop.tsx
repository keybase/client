import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import TabBar from './tab-bar.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'

function LeftTabNavigator({initialRouteName, children, screenOptions, backBehavior}) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    initialRouteName,
    screenOptions,
  })

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <TabBar state={state} navigation={navigation} />
        <Kb.BoxGrow>
          {state.routes.map((route, i) => {
            return i === state.index ? (
              <Kb.Box2 key={route.key} direction="vertical" fullHeight={true} fullWidth={true}>
                {descriptors[route.key].render()}
              </Kb.Box2>
            ) : null
          })}
        </Kb.BoxGrow>
      </Kb.Box2>
    </NavigationContent>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Styles.globalColors.white},
}))

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
