'use strict'

import * as Constants from '../constants/config'
import engine from '../engine'

export function getConfig () {
  return function (dispatch) {
    dispatch({
      type: Constants.configLoading
    })

    engine.rpc('config.getConfig', {}, {}, (error, config) => {
      if (error) {
        dispatch({
          type: Constants.configErrored,
          error: error
        })
      } else {
        dispatch({
          type: Constants.configLoaded,
          config: config
        })
      }
    })
  }
}
