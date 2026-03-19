const noop = () => {}

const navigation = {
  addListener: () => noop,
  canGoBack: () => false,
  dispatch: noop,
  emit: noop,
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
}

exports.useNavigation = () => navigation
exports.useIsFocused = () => true
