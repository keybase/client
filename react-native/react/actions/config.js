'use strict'

import * as types from '../constants/configActionTypes'
import engine from '../engine'

export function getConfig () {
  return function (dispatch) {
    dispatch({
      type: types.CONFIG_LOADING
    })

    engine.rpc('config.getConfig', {}, {}, (error, config) => {
      if (error) {
        dispatch({
          type: types.CONFIG_ERRORED,
          error: error
        })
      } else {
        dispatch({
          type: types.CONFIG_LOADED,
          config: config
        })
      }
    })
  }
}
