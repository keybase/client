// Hot reload management, so route state isn't lost when we hot reload
module.hot && module.hot.dispose(data => (data.navState = navState))
let navState: any = module.hot && module.hot.data && module.hot.data.navState

export const getPersistenceFunctions = () =>
  module.hot
    ? {
        loadNavigationState: () => navState,
        persistNavigationState: state => (navState = state),
      }
    : {}
