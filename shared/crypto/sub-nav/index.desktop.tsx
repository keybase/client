import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/crypto'
import * as Shim from '../../router-v2/shim'
import LeftNav from '../left-nav'
import {useNavigationBuilder, TabRouter, createNavigatorFactory, TabActions} from '@react-navigation/core'
import type Encrypt from '../operations/encrypt'
import type Decrypt from '../operations/decrypt'
import type Sign from '../operations/sign'
import type Verify from '../operations/verify'

/* Desktop SubNav */
const cryptoSubRoutes = {
  [Constants.encryptTab]: {
    getScreen: (): typeof Encrypt => require('../operations/encrypt/index').default,
  },
  [Constants.decryptTab]: {
    getScreen: (): typeof Decrypt => require('../operations/decrypt/index').default,
  },
  [Constants.signTab]: {getScreen: (): typeof Sign => require('../operations/sign/index').default},
  [Constants.verifyTab]: {getScreen: (): typeof Verify => require('../operations/verify/index').default},
}
function LeftTabNavigator({initialRouteName, children, screenOptions, backBehavior}) {
  const {state, navigation, descriptors, NavigationContent} = useNavigationBuilder(TabRouter, {
    backBehavior,
    children,
    screenOptions,
    initialRouteName,
  })

  const onChangeTab = React.useCallback(
    tab => {
      const event = navigation.emit({
        type: 'tabPress',
        canPreventDefault: true,
      })

      if (!event.defaultPrevented) {
        navigation.dispatch(TabActions.jumpTo(tab))
      }
    },
    [navigation]
  )

  return (
    <NavigationContent>
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true} style={styles.box}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.nav}>
          <LeftNav state={state} navigation={navigation} routes={state.routes} />
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
          const opt = typeof no === 'function' ? no({route, navigation}) : no
          return {...opt}
        }}
      />
    ))}
  </TabNavigator.Navigator>
)

CryptoSubNavigator.navigationOptions = {
  header: undefined,
  title: 'Crypto tools',
}

export default CryptoSubNavigator
