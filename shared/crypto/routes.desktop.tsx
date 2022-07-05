import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/crypto'
import * as Shim from '../router-v2/shim'
import {NavigationViewProps, createNavigator, StackRouter, SceneView} from '@react-navigation/core'
import TeamBuilder from '../team-building/container'
import Encrypt from './operations/encrypt'
import Decrypt from './operations/decrypt'
import Sign from './operations/sign'
import Verify from './operations/verify'

/* Desktop SubNav */
const noScreenProps = {}
const cryptoSubRoutes = {
  [Constants.decryptTab]: {
    getScreen: (): typeof Decrypt => require('./operations/decrypt/index').default,
  },
  [Constants.encryptTab]: {
    getScreen: (): typeof Encrypt => require('./operations/encrypt/index').default,
  },
  [Constants.signTab]: {getScreen: (): typeof Sign => require('./operations/sign/index').default},
  [Constants.verifyTab]: {getScreen: (): typeof Verify => require('./operations/verify/index').default},
}

const SubNavWrapper = React.memo((props: NavigationViewProps<any>) => {
  const navigation = props.navigation
  const index = navigation.state.index
  const activeKey = navigation.state.routes[index].key
  const descriptor = props.descriptors[activeKey]
  const childNav = descriptor.navigation
  const CryptoNav = require('./sub-nav').default

  return (
    <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={false}>
      <CryptoNav routeSelected={descriptor.state.routeName}>
        <Kb.BoxGrow>
          <SceneView
            navigation={childNav}
            component={descriptor.getComponent()}
            screenProps={props.screenProps || noScreenProps}
          />
        </Kb.BoxGrow>
      </CryptoNav>
    </Kb.Box2>
  )
})

const initialRouteName = Constants.encryptTab
const CryptoSubNavigator = createNavigator(
  SubNavWrapper,
  StackRouter(Shim.shim(cryptoSubRoutes), {initialRouteName}),
  {}
)

CryptoSubNavigator.navigationOptions = {
  header: undefined,
  title: 'Crypto tools',
}

/* Routes */
export const newRoutes = {
  // Crypto tab is driven by the sub nav on desktop
  cryptoRoot: {
    // MUST use screen and not getScreen for subnavs!
    screen: CryptoSubNavigator,
  },
}

export const newModalRoutes = {
  cryptoTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
