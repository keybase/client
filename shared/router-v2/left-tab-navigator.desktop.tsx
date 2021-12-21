import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import TabBar from './tab-bar.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'

function LeftTabNavigator({initialRouteName, children, screenOptions}) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    children,
    screenOptions,
    initialRouteName,
  })

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
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

// const tabStyles = Styles.styleSheetCreate(
//   () =>
//     ({
//       badge: Styles.platformStyles({
//         common: {
//           position: 'absolute',
//           right: 8,
//           top: 3,
//         },
//       }),
//       container: Styles.platformStyles({
//         common: {
//           justifyContent: 'center',
//           flex: 1,
//         },
//         isTablet: {
//           // This is to circumvent a React Navigation AnimatedComponent with minWidth: 64 that wraps TabBarIcon
//           minWidth: Styles.globalMargins.xlarge,
//         },
//       }),
//       label: {marginLeft: Styles.globalMargins.medium},
//       labelDarkMode: {color: Styles.globalColors.black_50},
//       labelDarkModeFocused: {color: Styles.globalColors.black},
//       labelLightMode: {color: Styles.globalColors.blueLighter},
//       labelLightModeFocused: {color: Styles.globalColors.white},
//       tab: Styles.platformStyles({
//         common: {
//           paddingBottom: 6,
//           paddingLeft: 16,
//           paddingRight: 16,
//           paddingTop: 6,
//         },
//         isTablet: {
//           width: '100%',
//         },
//       }),
//     } as const)
// )

export const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
