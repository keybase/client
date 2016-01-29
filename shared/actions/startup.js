import * as ConfigConstants from '../constants/config'
import {getConfig, getCurrentStatus} from './config'
import {autoLogin} from './login'
import engine from '../engine'

// This requires things across actions, so to avoid a circular dependency we'll pull this out
// into it's own file
export function startup () {
  return function (dispatch) {
    // Also call getCurrentStatus if the service goes away/comes back.
    engine.listenOnConnect('getCurrentStatus', () => dispatch(getCurrentStatus()).catch(error => {
      dispatch({type: ConfigConstants.startupLoaded, payload: error, error: true})
    }))

    dispatch({type: ConfigConstants.startupLoading})

    dispatch(getCurrentStatus())
      .then(() => {
        dispatch(autoLogin())
        return dispatch(getConfig())
      })
      .then(() => dispatch({type: ConfigConstants.startupLoaded}))
      .catch(error => {
        dispatch({type: ConfigConstants.startupLoaded, payload: error, error: true})
      })
  }
}

