import * as Constants from '../constants/router'

/*
 * This is a helper to handle async actions which want to transition to a new route
 * if the route is unchanged from beginning to end. An example would be a form where
 * if it succeeds we want to move to the next page but if they've gone somewhere else we don't
 *
 * Example usage:
  export function myFormAction (username, passphrase) {
    return appendRouteOnUnchanged((dispatch, getState, maybeRoute) => {
      validateWithBackend(username, (error, data) => {
        if (!error) {
          maybeRoute('userNameIsGoodPage')
        }
      })
    }
 */
export function appendRouteOnUnchanged (asyncAction) {
  return function (dispatch, getState) {
    const oldRoute = getCurrentURI(getState())
    asyncAction(dispatch, getState, nextPath => {
      if (oldRoute === getCurrentURI(getState())) {
        dispatch(routeAppend(nextPath))
      }
    })
  }
}

export function navigateUpOnUnchanged (asyncAction) {
  return function (dispatch, getState) {
    const oldRoute = getCurrentURI(getState())
    asyncAction(dispatch, getState, () => {
      if (oldRoute === getCurrentURI(getState())) {
        dispatch(navigateUp())
      }
    })
  }
}

export function getCurrentURI (state) {
  return state.tabbedRouter
    .getIn(['tabs', state.tabbedRouter.get('activeTab'), 'uri'])
}

export function getCurrentTab (state) {
  return state.tabbedRouter.get('activeTab')
}

export function navigateUp () {
  return {
    type: Constants.navigateUp
  }
}

export function navigateBack () {
  return {
    type: Constants.navigateBack
  }
}

export function navigateTo (uri) {
  return {
    type: Constants.navigate,
    payload: uri
  }
}

export function routeAppend (routeStr) {
  return {
    type: Constants.navigateAppend,
    payload: routeStr
  }
}
