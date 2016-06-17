/* @flow */
import * as Constants from '../constants/profile'
import {routeAppend} from './router'
import engine from '../engine'
import {identifyCommon, Common, proveCommon} from '../constants/types/keybase-v1'
import type {incomingCallMapType, userLoadUncheckedUserSummariesRpc, identifyIdentifyRpc, UserSummary} from '../constants/types/flow-types'
import type {AsyncAction, TypedAction} from '../constants/types/flux'

export function pushNewProfile (username: string) : AsyncAction {
  return function (dispatch) {
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

export function refreshProfile (username: string) : AsyncAction {
  return function (dispatch) {
    dispatch({
      type: Constants.profileLoading,
      payload: username
    })

    const incomingMap: incomingCallMapType = {
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
          [proveCommon.ProofState['tempFailure']]: 'Temporarily unavailable',
          [proveCommon.ProofState['looking']]: 'Looking'
        }[proofState]
        const error = {
          [proveCommon.ProofState['none']]: 'No proof',
          [proveCommon.ProofState['permFailure']]: 'Failed',
          [proveCommon.ProofState['superseded']]: 'Superseded',
          [proveCommon.ProofState['revoked']]: 'Revoked'
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

    const params : identifyIdentifyRpc = {
      method: 'identify.identify',
      param: {
        userAssertion: username,
        forceRemoteCheck: false,
        reason: {
          type: identifyCommon.IdentifyReasonType.none,
          reason: '',
          resource: ''
        },
        source: Common.ClientType.gui,
        useDelegateUI: false,
        trackStatement: false
      },
      incomingCallMap: incomingMap,
      callback: (error, results) => {
        if (error) {
          console.log('identity error: ', username)
        } else {
          console.log('search results', results)
          dispatch({
            type: Constants.profileLoaded,
            payload: {username, results, error}
          })

          if (results.user) {
            dispatch(loadSummaries([results.user.uid]))
          }
        }
      }
    }

    engine.rpc(params)
  }
}

type Summaries = {[key: string]: UserSummary}
export function loadSummaries (uids: Array<string>) : AsyncAction {
  return function (dispatch) {
    dispatch({
      type: Constants.profileSummaryLoading,
      payload: uids
    })

    const params : userLoadUncheckedUserSummariesRpc = {
      method: 'user.loadUncheckedUserSummaries',
      param: {uids: uids},
      incomingCallMap: {},
      callback: (error, response) => {
        if (error) {
          console.log(error)
          return
        }

        let summaries = {}
        response.forEach(r => {
          summaries[r.username] = {summary: r}
        })

        if (error) {
          dispatch(({
            type: Constants.profileSummaryLoaded,
            payload: error,
            error: true
          }: TypedAction<'profile:profileSummaryLoaded', Summaries, any>))
        } else {
          dispatch(({
            type: Constants.profileSummaryLoaded,
            payload: summaries,
            error: false
          }: TypedAction<'profile:profileSummaryLoaded', Summaries, any>))
        }
      }
    }

    engine.rpc(params)
  }
}
