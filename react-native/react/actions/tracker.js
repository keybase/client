/* @flow */

import * as Constants from '../constants/tracker'
import engine from '../engine'
import {createServer} from '../engine/server'
import {flattenCallMap, promisifyResponses} from '../engine/call-map-middleware'

import type {CallMap} from '../engine/call-map-middleware'
import type {UserSummary} from '../constants/types/flow-types'
import type {Action, Dispatch} from '../constants/types/flux'
import type {UserInfo} from '../tracker/bio.render'

import type {Identity, IdentifyKey, TrackSummary, User, Cryptocurrency, IdentifyOutcome, RemoteProof, LinkCheckResult} from '../constants/types/flow-types'

// TODO make actions for all the call back stuff.

export function registerIdentifyUi (): (dispatch: Dispatch) => void {
  return dispatch => {
    engine.rpc('delegateUiCtl.registerIdentifyUI', {}, {}, (error, response) => {
      if (error != null) {
        console.error('error in registering identify ui: ', error)
      }
    })

    createServer(
      engine,
      'keybase.1.identifyUi.delegateIdentifyUI',
      'keybase.1.identifyUi.finish',
      () => serverCallMap(dispatch)
    )
    dispatch({
      type: Constants.registerIdentifyUi,
      payload: {
        started: true
      }
    })
  }
}

export function onFollowChecked (newFollowCheckedValue: boolean): Action {
  console.log('follow checked:', newFollowCheckedValue)
  return {
    type: Constants.onFollowChecked,
    payload: newFollowCheckedValue
  }
}

export function onRefollow (): Action {
  console.log('onRefollow')
  return {
    type: Constants.onRefollow
  }
}

export function onUnfollow (): Action {
  console.log('onUnfollow')
  return {
    type: Constants.onUnfollow
  }
}

export function onFollowHelp (): Action {
  window.open('https://keybase.io/docs/tracking') // TODO
  return {
    type: Constants.onFollowHelp
  }
}

export function onCloseFromActionBar (): Action {
  return {
    type: Constants.onCloseFromActionBar
  }
}

export function onCloseFromHeader (): Action {
  return {
    type: Constants.onCloseFromHeader
  }
}

function loadUserInfo (uid: any): (dispatch: Dispatch) => void {
  return dispatch => {
    engine.rpc('user.loadUncheckedUserSummaries', {uids: [uid]}, {}, (error: ?any, response: Array<UserSummary>) => {
      if (error) {
        console.log(error)
        return
      }

      const onlyUser: ?UserSummary = response[0]
      if (!onlyUser) {
        console.log('Did not get back a user summary')
        return
      }

      dispatch(updateUserInfo({
        fullname: onlyUser.fullName,
        avatar: onlyUser.thumbnail,
        // TODO: get this data from somewhere
        location: 'TODO: get location data',
        followersCount: -1,
        followingCount: -1,
        followsYou: false
      }))
    })
  }
}

function updateUserInfo (userInfo: UserInfo): Action {
  return {
    type: Constants.updateUserInfo,
    payload: userInfo
  }
}

function serverCallMap (dispatch: Dispatch): CallMap {
  const identifyUi = {
    start: (params: {sessionID: number, username: string}) => {
      const {username} = params
      dispatch({
        type: Constants.updateUsername,
        payload: {username}
      })
    },
    displayKey: (params: {sessionID: number, key: IdentifyKey}) => {
    },
    reportLastTrack: (params: {sessionID: number, track: ?TrackSummary}) => {
    },

    launchNetworkChecks: (params: {sessionID: number, identity: Identity, user: User}) => {
      // This is the first spot that we have access to the user, so let's use that to get
      // The user information
      dispatch(loadUserInfo(params.user.uid))

      dispatch({
        type: Constants.setProofs,
        payload: {
          identity: params.identity
        }
      })
    },

    displayTrackStatement: (params: {sessionID: number, stmt: string}) => {
    },

    finishWebProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
      dispatch(updateProof(params.rp, params.lcr))
    },
    finishSocialProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
      dispatch(updateProof(params.rp, params.lcr))
    },
    displayCryptocurrency: (params: {sessionID: number, c: Cryptocurrency}) => {
    },
    reportTrackToken: (params: {sessionID: number, trackToken: string}) => {
    },
    confirm: (params: {sessionID: number, outcome: IdentifyOutcome}): bool => {
      return false
    },
    finish: (params: {sessionID: number}) => {


      // Check if there were any errors in the proofs
      dispatch({type: Constants.updateProofState})

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {
          active: false
        }
      })
    }
  }

  dispatch({
    type: Constants.markActiveIdentifyUi,
    payload: {
      active: true
    }
  })

  return promisifyResponses(flattenCallMap({ keybase: { '1': { identifyUi } } }))
}

function updateProof (remoteProof: RemoteProof, linkCheckResult: LinkCheckResult): Action {
  return {
    type: Constants.updateProof,
    payload: {remoteProof, linkCheckResult}
  }
}
