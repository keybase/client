const React = require('react')

const noop = () => {}

const makeNavigation = () => ({
  addListener: () => noop,
  canGoBack: () => false,
  dispatch: noop,
  emit: () => ({defaultPrevented: false}),
  getId: () => 'test-nav',
  getParent: () => undefined,
  getState: () => ({}),
  goBack: noop,
  isFocused: () => true,
  navigate: noop,
  removeListener: noop,
  reset: noop,
  setOptions: noop,
  setParams: noop,
})

const navigation = makeNavigation()

const makeNavigationContainerRef = () => ({
  addListener: () => noop,
  canGoBack: () => false,
  current: null,
  dispatch: noop,
  getCurrentOptions: () => undefined,
  getCurrentRoute: () => undefined,
  getParent: () => undefined,
  getRootState: () => undefined,
  getState: () => undefined,
  goBack: noop,
  isFocused: () => true,
  isReady: () => true,
  navigate: noop,
  removeListener: noop,
  reset: noop,
  setParams: noop,
})

exports.useNavigation = () => navigation
exports.useIsFocused = () => true
exports.useFocusEffect = fn => {
  if (typeof fn === 'function') {
    fn()
  }
}
exports.createNavigationContainerRef = () => makeNavigationContainerRef()

exports.CommonActions = {
  goBack: () => ({type: 'GO_BACK'}),
  navigate: payload => ({payload, type: 'NAVIGATE'}),
  reset: payload => ({payload, type: 'RESET'}),
  setParams: payload => ({payload, type: 'SET_PARAMS'}),
}

exports.StackActions = {
  popTo: name => ({payload: {name}, type: 'POP_TO'}),
  popToTop: () => ({type: 'POP_TO_TOP'}),
  push: (name, params) => ({payload: {name, params}, type: 'PUSH'}),
  replace: (name, params) => ({payload: {name, params}, type: 'REPLACE'}),
}

exports.TabActions = {
  jumpTo: name => ({payload: {name}, type: 'JUMP_TO'}),
}

exports.TabRouter = config => ({
  backBehavior: config?.backBehavior,
  getInitialState: () => ({index: 0, key: 'tab-state', routeNames: [], routes: [], stale: false, type: 'tab'}),
  type: 'tab',
})

exports.useNavigationBuilder = (_router, _options) => ({
  descriptors: {},
  NavigationContent: ({children}) => React.createElement(React.Fragment, null, children),
  navigation,
  state: {index: 0, key: 'nav-state', routeNames: [], routes: [], stale: false, type: 'tab'},
})

exports.createNavigatorFactory = NavigatorComponent => {
  const Screen = () => null
  const Navigator = props => React.createElement(NavigatorComponent, props)
  return () => ({Navigator, Screen})
}

exports.createComponentForStaticNavigation = () => {
  return function StaticNavigationComponent() {
    return null
  }
}
