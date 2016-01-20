import * as Constants from '../constants/profile'
import {routeAppend} from './router'
import engine from '../engine'
import {identify} from '../constants/types/keybase_v1'
const enums = identify

export function pushNewProfile (username) {
  return function (dispatch, getState) {
    dispatch({
      type: Constants.initProfile,
      payload: {
        username
      }
    })
    dispatch(routeAppend({
      path: 'profile',
      username
    }))

    // always refresh, TODO some caching strategy
    dispatch(refreshProfile(username))
  }
}

export function refreshProfile (username) {
  return function (dispatch) {
    dispatch({
      type: Constants.profileLoading,
      payload: username
    })

    const incomingMap = {
      'keybase.1.identifyUi.start': (param, response) => { response.result() },
      'keybase.1.identifyUi.reportLastTrack': (param, response) => { response.result() },
      'keybase.1.identifyUi.displayKey': ({key}, response) => {
        const hex = key.pgpFingerprint.toString('hex')
        const shortHex = hex.substring(hex.length - 16).toUpperCase()
        const display = shortHex.split('').reduce((a, b, i) => a + ((i % 4) ? '' : ' ') + b)

        dispatch({
          type: Constants.profileReceivedDisplayKey,
          payload: {
            username,
            key: {...key, type: 'PGP', display}
          }
        })

        response.result()
      },
      'keybase.1.identifyUi.launchNetworkChecks': ({identity: {proofs}}, response) => {
        dispatch({
          type: Constants.profileCheckingNetworks,
          payload: {
            username,
            networks: proofs.map(p => p.proof.key)
          }
        })

        response.result()
      },
      'keybase.1.identifyUi.finishSocialProofCheck': (param, response) => {
        const {
          lcr: {
            proofResult: {
              state: proofState
            }
          }
        } = param

        const {
          rp: {
            key: network,
            value: display
          }
        } = param

        const warning = {
          [enums['tempFailure']]: 'Temporarily unavailable',
          [enums['looking']]: 'Looking'
        }[proofState]
        const error = {
          [enums['none']]: 'No proof',
          [enums['permFailure']]: 'Failed',
          [enums['superseded']]: 'Superseded',
          [enums['revoked']]: 'Revoked'
        }[proofState]

        dispatch({
          type: Constants.profileNetworkUpdate,
          payload: {
            username,
            network,
            update: {
              display,
              warning,
              error
            }
          }
        })

        response.result()
      },

      'keybase.1.identifyUi.finish': (param, response) => {
        response.result()
      }
    }

    const params = {
      userAssertion: username,
      forceRemoteCheck: false,
      trackStatement: false
    }

    engine.rpc('identify.identify', params, incomingMap,
      (error, results) => {
        if (error) {
          console.log('identity error: ', username)
        } else {
          console.log('search results', results)
          dispatch({
            type: Constants.profileLoaded,
            payload: {
              username,
              results,
              error
            }
          })

          dispatch(loadSummaries([results.user.uid]))
        }
      }
    )
  }
}

export function loadSummaries (uids) {
  return function (dispatch) {
    dispatch({
      type: Constants.profileSummaryLoading,
      payload: uids
    })

    engine.rpc('user.loadUncheckedUserSummaries', {uids: uids}, {}, (error, response) => {
      if (error) {
        console.log(error)
        return
      }

      let summaries = {}
      response.forEach(r => {
        summaries[r.username] = {summary: r}
      })

      dispatch({
        type: Constants.profileSummaryLoaded,
        payload: error || summaries,
        error: !!error
      })
    })
  }
}
