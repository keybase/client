import TeamBuilder from '../team-building/container'

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

class SubNavWrapper extends React.PureComponent<NavigationViewProps<any>> {
  render() {
    const navigation = this.props.navigation
    const index = navigation.state.index
    const activeKey = navigation.state.routes[index].key
    const descriptor = this.props.descriptors[activeKey]
    const childNav = descriptor.navigation
    const CryptoNav = requrie('./sub-nav').default

    return (
      <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={false}>
        <CryptoNav routeSelected={descriptor.state.routeName}>
          <Kb.BoxGrow>
            <SceneView
              navigation={childNav}
              component={descriptor.getComponent()}
              screenProps={this.props.screenProps || noScreenProps}
            />
          </Kb.BoxGrow>
        </CryptoNav>
      </Kb.Box2>
    )
  }
}

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

export const newRoutes = {
  //. Crypto tab is driven by the sub nav on desktop
  cryptoRoot: {
    // MUST use screen and not getScreen for subnavs!
    screen: CryptoSubNavigator,
  },
}

export const newModalRoutes = {
  cryptoTeamBuilder: {getScreen: (): typeof TeamBuilder => require('../team-building/container').default},
}
