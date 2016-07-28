// @flow
import * as Constants from '../../constants/config'
import type {AsyncAction} from '../../constants/types/flux'

export function getDevSettings (): AsyncAction {
  return (dispatch) => {
    dispatch({
      type: Constants.devConfigLoading,
      payload: {},
    })

    dispatch({
      type: Constants.devConfigLoaded,
      payload: {},
    })
  }
}

export function saveDevSettings () {
  return {
    type: Constants.devConfigSaved,
  }
}

export function updateDevSettings (updates: any) {
  return {
    type: Constants.devConfigUpdate,
    payload: {updates},
  }
}
