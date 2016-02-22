import * as ConfigConstants from '../constants/config'
import {getConfig, getCurrentStatus} from './config'
import {autoLogin} from './login'
import engine from '../engine'

// This requires things across actions, so to avoid a circular dependency we'll pull this out
// into it's own file
export function startup () {
  return function (dispatch) {
    dispatch({type: ConfigConstants.startupLoading})

    engine.listenOnConnect('getCurrentStatus', () => {
      return (
        Promise.all([dispatch(getCurrentStatus()), dispatch(getConfig())])
          .then(() => {
            dispatch({type: ConfigConstants.startupLoaded})
            dispatch(autoLogin())
          })
          .catch(error => {
            console.error('Error starting up:', error)
            dispatch({type: ConfigConstants.startupLoaded, payload: error, error: true})
          })
      )
    })
  }
}

