'use strict'

import * as types from '../constants/profileActionTypes'
import { routeAppend } from './router'
import engine from '../engine'
import { identify } from '../keybase_v1'
const enums = identify

export function pushNewProfile (username) {
  return function (dispatch, getState) {
    dispatch({
      type: types.INIT_PROFILE,
      username,
      avatar: `${getState().config.serverURI}/${username}/picture?format=square_200`
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
      username,
      type: types.PROFILE_LOADING
    })

    const incomingMap = {
      'keybase.1.identifyUi.start': (param, response) => { response.result() },
      'keybase.1.identifyUi.reportLastTrack': (param, response) => { response.result() },
      'keybase.1.identifyUi.displayKey': ({key}, response) => {
        const hex = key.pgpFingerprint.toString('hex')
        const shortHex = hex.substring(hex.length - 16).toUpperCase()
        const display = shortHex.split('').reduce((a, b, i) => a + ((i % 4) ? '' : ' ') + b)

        dispatch({
          username,
          type: types.PROFILE_RECEIVED_DISPLAY_KEY,
          key: {...key, type: 'PGP', display}
        })

        response.result()
      },
      'keybase.1.identifyUi.launchNetworkChecks': ({identity: {proofs}}, response) => {
        dispatch({
          username,
          type: types.PROFILE_CHECKING_NETWORKS,
          networks: proofs.map(p => p.proof.key)
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
          username,
          type: types.PROFILE_NETWORK_UPDATE,
          network,
          update: {
            display,
            warning,
            error
          }
        })

        response.result()
      },

      'keybase.1.identifyUi.finish': (param, response) => {
        response.result()
      }
    }

    engine.rpc('identify.identify', {userAssertion: username, forceRemoteCheck: false, trackStatement: false}, incomingMap,
      (error, results) => {
        console.log('search results', results)
        dispatch({
          username,
          type: types.PROFILE_LOADED,
          results,
          error
        })
      }
    )
  }
}
