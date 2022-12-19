import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Common from '../router-v2/common'
import * as Constants from '../constants/settings'
import * as Shim from '../router-v2/shim'
import LeftNav from './sub-nav/left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import {sharedNewRoutes} from './routes.shared'

const settingsSubRoutes = {
  ...sharedNewRoutes,
}

function LeftTabNavigator({initialRouteName, children, screenOptions, backBehavior}) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    initialRouteName,
    screenOptions,
  })

  const selectedTab = state.routes[state.index]?.name ?? ''
  const onSelectTab = Common.useSubnavTabAction(navigation as any, state)

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.nav}>
          <LeftNav onClick={onSelectTab} selected={selectedTab} navigate={s => navigation.navigate(s)} />
        </Kb.Box2>
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
  nav: {width: Styles.isTablet ? 200 : 180},
}))

const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
const TabNavigator = createLeftTabNavigator()

const shimmed = Shim.shim(settingsSubRoutes, false, false)

// TODO on ipad this doesn't have a stack navigator so when you go into crypto you get
// a push from the parent stack. If we care just make a generic left nav / right stack
// that the global app / etc could use and put it here also. not worth it now
const SettingsSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={Constants.accountTab} backBehavior="none">
    {Object.keys(shimmed).map(name => (
      <TabNavigator.Screen
        key={name}
        name={name}
        getComponent={settingsSubRoutes[name].getScreen}
        options={({route, navigation}) => {
          const no = settingsSubRoutes[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

SettingsSubNavigator.navigationOptions = {
  title: 'Settings',
}

export default SettingsSubNavigator
