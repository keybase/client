import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import * as Tabs from '../constants/tabs'
import * as Container from '../util/container'
import * as Shared from './router.shared'
import TabBar from './tab-bar.desktop'
import {useNavigationBuilder, TabRouter, TabActions, createNavigatorFactory} from '@react-navigation/core'

// const TabBarIcon = props => {
//   const {isFocused, routeName} = props
//   const onSettings = routeName === Tabs.settingsTab
//   const navBadges = Container.useSelector(state => state.notifications.navBadges)
//   const badgeNumber = (onSettings ? Shared.settingsTabChildren : [routeName]).reduce(
//     (res, tab) => res + (navBadges.get(tab) || 0),
//     0
//   )
//   return Shared.tabToData[routeName] ? (
//     <Kb.Box2 direction="vertical" style={tabStyles.container}>
//       <Kb.Icon
//         type={Shared.tabToData[routeName].icon}
//         fontSize={32}
//         style={tabStyles.tab}
//         color={isFocused ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blueDarkerOrBlack}
//       />
//       {!!badgeNumber && <Kb.Badge badgeNumber={badgeNumber} badgeStyle={tabStyles.badge} />}
//       {routeName === Tabs.fsTab && <Shared.FilesTabBadge />}
//     </Kb.Box2>
//   ) : null
// }

// const TabBar = ({state, navigation}) => {
//   return (
//     <Kb.Box2 direction="vertical" fullHeight={true} style={styles.tabBar}>
//       {state.routes.map(route => (
//         <TabBarIcon
//           key={route.key}
//           onPress={() => {
//             const event = navigation.emit({
//               type: 'tabPress',
//               target: route.key,
//               canPreventDefault: true,
//             })
//
//             if (!event.defaultPrevented) {
//               navigation.dispatch({
//                 ...TabActions.jumpTo(route.name),
//                 target: state.key,
//               })
//             }
//           }}
//           style={{flex: 1}}
//         />
//       ))}
//     </Kb.Box2>
//   )
// }

function LeftTabNavigator({initialRouteName, children, screenOptions}) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    children,
    screenOptions,
    initialRouteName,
  })

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
        <TabBar state={state} navigation={navigation} selectedTab={state.routes[state.index]?.name} />
        <Kb.BoxGrow style={styles.scene}>
          {state.routes.map((route, i) => {
            return i === state.index ? (
              <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
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
  tabBar: {
    width: 100,
  },
}))
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
