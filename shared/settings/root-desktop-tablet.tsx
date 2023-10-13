import * as C from '../constants'
import * as Kb from '../common-adapters'
import * as Common from '../router-v2/common'
import {shim, getOptions} from '../router-v2/shim'
import LeftNav from './sub-nav/left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import {sharedNewRoutes} from './routes'

const settingsSubRoutes = {
  ...sharedNewRoutes,
}

function LeftTabNavigator({initialRouteName, children, screenOptions, backBehavior}: any) {
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
                {descriptors[route.key]?.render()}
              </Kb.Box2>
            ) : null
          })}
        </Kb.BoxGrow>
      </Kb.Box2>
    </NavigationContent>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  box: {backgroundColor: Kb.Styles.globalColors.white},
  nav: {width: Kb.Styles.isTablet ? 200 : 180},
}))

const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
const TabNavigator = createLeftTabNavigator()

const shimmed = shim(settingsSubRoutes, false, false)

// TODO on ipad this doesn't have a stack navigator so when you go into crypto you get
// a push from the parent stack. If we care just make a generic left nav / right stack
// that the global app / etc could use and put it here also. not worth it now
const SettingsSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={C.settingsAccountTab} backBehavior="none">
    {Object.keys(shimmed).map(name => (
      <TabNavigator.Screen
        key={name}
        name={name}
        // @ts-ignore
        getComponent={settingsSubRoutes[name].getScreen}
        options={({route, navigation}) => {
          // @ts-ignore
          const no = getOptions(settingsSubRoutes[name])
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

export default SettingsSubNavigator
