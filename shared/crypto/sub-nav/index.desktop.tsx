import * as Kb from '@/common-adapters'
import * as Constants from '@/constants/crypto'
import * as Common from '@/router-v2/common.desktop'
import LeftNav from './left-nav.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import decryptIO from './decrypt.inout.page'
import encryptIO from './encrypt.inout.page'
import signIO from './sign.inout.page'
import verifyIO from './verify.inout.page'
import {getOptions, shim} from '@/router-v2/shim'

/* Desktop SubNav */
const cryptoSubRoutes = {
  [Constants.decryptTab]: decryptIO,
  [Constants.encryptTab]: encryptIO,
  [Constants.signTab]: signIO,
  [Constants.verifyTab]: verifyIO,
}
function LeftTabNavigator({
  initialRouteName,
  children,
  screenOptions,
  backBehavior,
}: Parameters<typeof useNavigationBuilder>[1] & {
  backBehavior: 'initialRoute' | 'firstRoute' | 'history' | 'order' | 'none'
}) {
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
          <LeftNav onClick={onSelectTab} selected={selectedTab} />
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
  nav: {width: 180},
}))

const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
const TabNavigator = createLeftTabNavigator()

const shimmed = shim(cryptoSubRoutes, false, false)
const shimKeys = Object.keys(shimmed) as Array<keyof typeof shimmed>

const CryptoSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={Constants.encryptTab} backBehavior="none">
    {shimKeys.map(name => (
      <TabNavigator.Screen
        key={name}
        name={name}
        getComponent={cryptoSubRoutes[name].getScreen}
        options={({route, navigation}) => {
          const no = getOptions(cryptoSubRoutes[name])
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

export default CryptoSubNavigator
