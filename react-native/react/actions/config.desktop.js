'use strict'

import * as Constants from '../constants/config'
import engine from '../engine'

export function getConfig () {
  return function (dispatch) {
    dispatch({
      type: Constants.startupLoading
    })

    engine.rpc('config.getConfig', {}, {}, (error, config) => {
      dispatch({
        type: Constants.startupLoaded,
        payload: error || config,
        error: !!error
      })
    })
  }
}
