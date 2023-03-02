import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/crypto'
import * as Common from '../../router-v2/common.desktop'
import * as Shim from '../../router-v2/shim'
import LeftNav from './left-nav.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import type Encrypt from '../operations/encrypt'
import type Decrypt from '../operations/decrypt'
import type Sign from '../operations/sign'
import type Verify from '../operations/verify'

/* Desktop SubNav */
const cryptoSubRoutes = {
  [Constants.decryptTab]: {
    getScreen: (): typeof Decrypt => require('../operations/decrypt/index').default,
  },
  [Constants.encryptTab]: {
    getScreen: (): typeof Encrypt => require('../operations/encrypt/index').default,
  },
  [Constants.signTab]: {getScreen: (): typeof Sign => require('../operations/sign/index').default},
  [Constants.verifyTab]: {getScreen: (): typeof Verify => require('../operations/verify/index').default},
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
          <LeftNav onClick={onSelectTab} selected={selectedTab} />
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
  nav: {width: 180},
}))

const createLeftTabNavigator = createNavigatorFactory(LeftTabNavigator)
const TabNavigator = createLeftTabNavigator()

const shimmed = Shim.shim(cryptoSubRoutes, false, false)

const CryptoSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={Constants.encryptTab} backBehavior="none">
    {Object.keys(shimmed).map(name => (
      <TabNavigator.Screen
        key={name}
        name={name}
        getComponent={cryptoSubRoutes[name].getScreen}
        options={({route, navigation}) => {
          const no = cryptoSubRoutes[name].getScreen().navigationOptions
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

export default CryptoSubNavigator
