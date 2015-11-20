import * as Constants from '../../constants/config'
import {autoLogin} from '../login'
import engine from '../../engine'
import * as native from './index.native'

export function startup () {
  return function (dispatch) {
    dispatch({type: Constants.startupLoading})

    const incomingMap = {
      'keybase.1.logUi.log': (param, response) => {
        console.log(param)
        response.result()
      }
    }

    engine.rpc('config.getConfig', {}, incomingMap, (error, config) => {
      if (error) {
        dispatch({type: Constants.startupLoaded, payload: error, error: true})
        return
      }
      engine.rpc('config.getCurrentStatus', {}, incomingMap, (error, status) => {
        if (error) {
          dispatch({type: Constants.startupLoaded, payload: error, error: true})
          return
        }
        dispatch({
          type: Constants.startupLoaded,
          payload: {config, status}
        })

        if (status.loggedIn) {
          dispatch(autoLogin())
        }
      })
    })
  }
}

export function getDevSettings () {
  return native.getDevSettings()
}

export function saveDevSettings () {
  return native.saveDevSettings()
}

export function updateDevSettings (updates) {
  return native.updateDevSettings(updates)
}
