/* @flow */

import * as Constants from '../constants/tracker'
import {routeAppend} from './router'
import engine from '../engine'
import {createServer} from '../engine/server'
import {flattenCallMap, promisifyResponses} from '../engine/call-map-middleware'

import type {CallMap} from '../engine/call-map-middleware'
import type {UserSummary} from '../constants/types/flow-types'
import type {Action, Dispatch} from '../constants/types/flux'
import type {UserInfo} from '../tracker/bio.render.types'

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

export function pushDebugTracker (username: string): (dispatch: Dispatch) => void {
  return dispatch => {
    dispatch({
      type: Constants.updateUsername,
      payload: {username}
    })

    dispatch(routeAppend([{path: 'tracker', username}]))
  }
}

export function onFollowChecked (newFollowCheckedValue: boolean, username: string): Action {
  console.log('follow checked:', newFollowCheckedValue)
  return {
    type: Constants.onFollowChecked,
    payload: {
      shouldFollow: newFollowCheckedValue,
      username
    }
  }
}

export function onRefollow (username: string): Action {
  console.log('onRefollow')
  return {
    type: Constants.onRefollow,
    payload: {username}
  }
}

export function onUnfollow (username: string): Action {
  console.log('onUnfollow')
  return {
    type: Constants.onUnfollow,
    payload: {username}
  }
}

export function onFollowHelp (username: string): Action {
  window.open('https://keybase.io/docs/tracking') // TODO
  return {
    type: Constants.onFollowHelp,
    payload: {username}
  }
}

export function onCloseFromActionBar (username: string): Action {
  return {
    type: Constants.onCloseFromActionBar,
    payload: {username}
  }
}

export function onCloseFromHeader (username: string): Action {
  return {
    type: Constants.onCloseFromHeader,
    payload: {username}
  }
}

function loadUserInfo (uid: any, username:string): (dispatch: Dispatch) => void {
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
        location: onlyUser.location,
        followersCount: -1,
        followingCount: -1,
        followsYou: false
      }, username))
    })
  }
}

function updateUserInfo (userInfo: UserInfo, username: string): Action {
  return {
    type: Constants.updateUserInfo,
    payload: {
      userInfo,
      username
    }
  }
}

// TODO: if we get multiple tracker calls we should cancel one of the sessionIDs, now they'll clash
function serverCallMap (dispatch: Dispatch): CallMap {
  const sessionIDToUsername: { [key: number]: string } = {}
  const identifyUi = {
    start: (params: {sessionID: number, username: string}) => {
      const {username, sessionID} = params
      sessionIDToUsername[sessionID] = username

      dispatch({
        type: Constants.updateUsername,
        payload: {username}
      })

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {username, active: true}
      })

      dispatch({
        type: Constants.reportLastTrack,
        payload: {username}
      })
    },
    displayKey: (params: {sessionID: number, key: IdentifyKey}) => {
    },
    reportLastTrack: (params: {sessionID: number, track: ?TrackSummary}) => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch({
        type: Constants.reportLastTrack,
        payload: {
          username,
          track: params.track
        }
      })
    },

    launchNetworkChecks: (params: {sessionID: number, identity: Identity, user: User}) => {
      const username = sessionIDToUsername[params.sessionID]
      // This is the first spot that we have access to the user, so let's use that to get
      // The user information
      dispatch(loadUserInfo(params.user.uid, username))

      dispatch({
        type: Constants.setProofs,
        payload: {
          identity: params.identity,
          username
        }
      })
      dispatch({type: Constants.updateProofState, payload: {username}})
    },

    displayTrackStatement: (params: {sessionID: number, stmt: string}) => {
    },

    finishWebProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateProof(params.rp, params.lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})
      dispatch({type: Constants.decideToShowTracker, payload: {username}})
    },
    finishSocialProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
      const username = sessionIDToUsername[params.sessionID]
      dispatch(updateProof(params.rp, params.lcr, username))
      dispatch({type: Constants.updateProofState, payload: {username}})
      dispatch({type: Constants.decideToShowTracker, payload: {username}})
    },
    displayCryptocurrency: (params: {sessionID: number, c: Cryptocurrency}) => {
    },
    reportTrackToken: (params: {sessionID: number, trackToken: string}) => {
    },
    confirm: (params: {sessionID: number, outcome: IdentifyOutcome}): bool => {
      return false
    },
    finish: (params: {sessionID: number}) => {
      const username = sessionIDToUsername[params.sessionID]
      // Check if there were any errors in the proofs
      dispatch({type: Constants.updateProofState, payload: {username}})

      dispatch({
        type: Constants.markActiveIdentifyUi,
        payload: {
          active: false,
          username
        }
      })
    }
  }

  return promisifyResponses(flattenCallMap({keybase: {'1': {identifyUi}}}))
}

function updateProof (remoteProof: RemoteProof, linkCheckResult: LinkCheckResult, username: string): Action {
  return {
    type: Constants.updateProof,
    payload: {remoteProof, linkCheckResult, username}
  }
}
