import * as Constants from '../../constants/config'

export function getDevSettings () {
  return function (dispatch) {
    dispatch({
      type: Constants.devConfigLoading,
    })

    dispatch({
      type: Constants.devConfigLoaded,
      payload: {},
    })
  }
}

export function saveDevSettings () {
  return function (dispatch, getState) {
    return dispatch({type: Constants.devConfigSaved})
  }
}

export function updateDevSettings (updates) {
  return {
    type: Constants.devConfigUpdate,
    payload: {updates},
  }
}
