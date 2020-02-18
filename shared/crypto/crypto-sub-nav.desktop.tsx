import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Shim from '../router-v2/shim'
import * as Constants from '../constants/crypto'
import {NavigationViewProps, createNavigator, StackRouter, SceneView} from '@react-navigation/core'
import Encrypt from './operations/encrypt'
import Decrypt from './operations/decrypt'
import Sign from './operations/sign'
import Verify from './operations/verify'

const noScreenProps = {}

const cryptoSubRoutes = {
  [Constants.decryptTab]: {
    getScreen: (): typeof Decrypt => require('./operations/decrypt').default,
  },
  [Constants.encryptTab]: {
    getScreen: (): typeof Encrypt => require('./operations/encrypt').default,
  },
  [Constants.signTab]: {getScreen: (): typeof Sign => require('./operations/sign').default},
  [Constants.verifyTab]: {getScreen: (): typeof Verify => require('./operations/verify').default},
}

class CryptoSubNav extends React.PureComponent<NavigationViewProps<any>> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation
    const ListAndActiveOperation = require('./operations-list').default

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={false}>
        <ListAndActiveOperation routeSelected={descriptor.state.routeName}>
          <Kb.BoxGrow>
            <SceneView
              navigation={childNav}
              component={descriptor.getComponent()}
              screenProps={this.props.screenProps || noScreenProps}
            />
          </Kb.BoxGrow>
        </ListAndActiveOperation>
      </Kb.Box2>
    )
  }
}

const initialRouteName = Constants.encryptTab
const CryptoSubNavigator = createNavigator(
  CryptoSubNav,
  StackRouter(Shim.shim(cryptoSubRoutes), {initialRouteName}),
  {}
)

CryptoSubNavigator.navigationOptions = {
  header: undefined,
  title: 'Crypto tools',
}

export default CryptoSubNavigator
