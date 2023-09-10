import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/crypto'
import * as Common from '../../router-v2/common.desktop'
import * as Shim from '../../router-v2/shim'
import LeftNav from './left-nav.desktop'
import {useNavigationBuilder, TabRouter, createNavigatorFactory} from '@react-navigation/core'
import {type EncryptIO} from '../operations/encrypt'
import {type DecryptIO} from '../operations/decrypt'
import {type SignIO} from '../operations/sign'
import {type VerifyIO} from '../operations/verify'
import {getOptions} from '../../router-v2/shim.shared'

/* Desktop SubNav */
const cryptoSubRoutes = {
  [Constants.decryptTab]: {
    getScreen: (): typeof DecryptIO => require('../operations/decrypt').DecryptIO,
  },
  [Constants.encryptTab]: {
    getScreen: (): typeof EncryptIO => require('../operations/encrypt').EncryptIO,
  },
  [Constants.signTab]: {getScreen: (): typeof SignIO => require('../operations/sign').SignIO},
  [Constants.verifyTab]: {getScreen: (): typeof VerifyIO => require('../operations/verify').VerifyIO},
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
          <LeftNav onClick={onSelectTab} selected={selectedTab} />
        </Kb.Box2>
        <Kb.BoxGrow>
          {state.routes.map((route, i) => {
            return i === state.index ? (
              <Kb.Box2 key={route.key} direction="vertical" fullHeight={true} fullWidth={true}>
                {// @ts-ignore
                descriptors[route.key]?.render()}
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

const shimmed = Shim.shim(cryptoSubRoutes, false, false)

const CryptoSubNavigator = () => (
  <TabNavigator.Navigator initialRouteName={Constants.encryptTab} backBehavior="none">
    {Object.keys(shimmed).map(name => (
      <TabNavigator.Screen
        key={name}
        name={name}
        getComponent={
          // @ts-ignore
          cryptoSubRoutes[name].getScreen
        }
        options={({route, navigation}) => {
          // @ts-ignore
          const no = getOptions(cryptoSubRoutes[name])
          const opt = typeof no === 'function' ? no({navigation, route}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

export default CryptoSubNavigator
