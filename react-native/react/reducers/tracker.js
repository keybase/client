'use strict'
/* @flow */

import * as Constants from '../constants/tracker'
import {normal, warning, error, pending} from '../constants/tracker'

import {identify} from '../keybase_v1'

import type {UserInfo} from '../tracker/bio.render.desktop'
import type {Proof} from '../tracker/proofs.render.desktop'
import type {SimpleProofState} from '../constants/tracker'

import type {Identity, RemoteProof, LinkCheckResult, ProofState} from '../constants/types/flow-types'
import type {Action} from '../constants/types/flux'

type State = {
  serverStarted: boolean,
  serverActive: boolean,
  proofState: SimpleProofState,
  username: ?string,
  shouldFollow: ?boolean,
  reason: string,
  userInfo: UserInfo,
  proofs: Array<Proof>
}

const initialProofState = pending

const initialState: State = {
  serverStarted: false,
  serverActive: false,
  username: null,
  proofState: initialProofState,
  shouldFollow: true,
  proofs: [],
  reason: 'TODO: get the reason',
  userInfo: {
    fullname: 'TODO: get this information',
    followersCount: -1,
    followingCount: -1,
    followsYou: false,
    avatar: 'TODO: get this information',
    location: 'TODO: get this information'
  }
}

export default function (state: State = initialState, action: Action): State {
  switch (action.type) {
    case Constants.onFollowChecked:
      if (action.payload == null) {
        return state
      }
      const shouldFollow: boolean = action.payload

      return {
        ...state,
        shouldFollow
      }
    case Constants.updateUsername:
      if (!action.payload) {
        return state
      }
      const username = action.payload.username

      return {
        ...state,
        username
      }

    case Constants.updateProofState:
      const proofs = state.proofs
      const allOk: boolean = proofs.reduce((acc, p) => acc && p.state === normal, true)
      const anyWarnings: boolean = proofs.reduce((acc, p) => acc || p.state === warning, true)
      const anyError: boolean = proofs.reduce((acc, p) => acc || p.state === error, false)
      const anyPending: boolean = proofs.reduce((acc, p) => acc || p.state === pending, false)

      let proofState: SimpleProofState = 'error'

      if (allOk) {
        proofState = 'normal'
      } else if (anyWarnings) {
        proofState = 'warning'
      } else if (anyError) {
        proofState = 'error'
      } else if (anyPending) {
        proofState = 'pending'
      }

      return {
        ...state,
        proofState
      }

    case Constants.setProofs: 
      if (!action.payload) {
        return state
      }

      const identity: Identity = action.payload.identity

      return {
        ...state,
        proofs: identity.proofs.map(rp => remoteProofToProof(rp.proof))
      }

    case Constants.updateProof:
      if (!action.payload) {
        return state
      }

      const rp: RemoteProof = action.payload.remoteProof
      const lcr: LinkCheckResult = action.payload.linkCheckResult
      return {
        ...state,
        proofs: updateProof(state.proofs, rp, lcr)
      }

    case Constants.updateUserInfo:
      if (!action.payload) {
        return state
      }
      return {
        ...state,
        userInfo: action.payload
      }

    case Constants.registerIdentifyUi:
      return {
        ...state,
        serverStarted: action.payload && !!action.payload.started || false
      }

    case Constants.markActiveIdentifyUi:
      return {
        ...state,
        serverActive: action.payload && !!action.payload.active || false
      }

    default:
      return state
  }
}

function mapTagToName (obj: any, tag: any): ?string {
  return Object.keys(obj).filter(x => obj[x] === tag)[0]
}

function stateToColor (state: SimpleProofState): string {
  if (state === normal) {
    return 'green'
  } else if (state === warning) {
    return 'yellow'
  } else if (state === error) {
    return 'red'
  }

  return 'gray'
}

function proofStateToSimpleProofState (proofState: ProofState): SimpleProofState {
  const statusName: ?string = mapTagToName(identify.ProofState, proofState)
  switch (statusName) {
    case 'ok':
      return normal
    case 'tempFailure':
    case 'superseded':
    case 'posted':
      return warning
    case 'revoked':
    case 'permFailure':
      return error
    case 'looking':
    case 'none':
    default:
      return pending
  }
}

function remoteProofToProof (rp: RemoteProof, lcr: ?LinkCheckResult): Proof {
  const proofState: SimpleProofState = lcr && proofStateToSimpleProofState(lcr.proofResult.state) || pending

  let proofType: string = ''
  if (rp.proofType === identify.ProofType.genericWebSite || rp.proofType === identify.ProofType.dns) {
    proofType = 'web'
  } else {
    proofType = mapTagToName(identify.ProofType, rp.proofType) || ''
  }

  return {
    state: proofState,
    id: rp.sigID,
    type: proofType,
    color: stateToColor(proofState),
    name: rp.displayMarkup,
    humanUrl: (lcr && lcr.hint && lcr.hint.humanUrl)
  }
}

function updateProof (proofs: Array<Proof>, rp: RemoteProof, lcr: LinkCheckResult): Array<Proof> {
  return proofs.map(proof => {
    if (proof.id === rp.sigID) {
      return remoteProofToProof(rp, lcr)
    }
    return proof
  })
}
