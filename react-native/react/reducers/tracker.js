/* @flow */

import * as Constants from '../constants/tracker'
import {normal, warning, error, checking} from '../constants/tracker'
import {metaNew, metaUpgraded} from '../constants/tracker'

import {identify} from '../constants/types/keybase_v1'

import type {UserInfo} from '../tracker/bio.render.desktop'
import type {Proof} from '../tracker/proofs.render.desktop'
import type {SimpleProofState, SimpleProofMeta} from '../constants/tracker'

import type {Identity, RemoteProof, LinkCheckResult, ProofState, identifyUi_TrackDiffType} from '../constants/types/flow-types'
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

const initialProofState = checking

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
    avatar: null,
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
      const anyPending: boolean = proofs.reduce((acc, p) => acc || p.state === checking, false)

      let proofState: SimpleProofState = error

      if (allOk) {
        proofState = normal
      } else if (anyWarnings) {
        proofState = warning
      } else if (anyError) {
        proofState = error
      } else if (anyPending) {
        proofState = checking
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
      return checking
  }
}

function trackDiffToSimpleProofMeta (diff: identifyUi_TrackDiffType): ?SimpleProofMeta {
  return {
    // $FlowIssue no computed
    [0]: null, /* 'NONE_0' */
    // $FlowIssue no computed
    [1]: null, /* 'ERROR_1' */
    // $FlowIssue no computed
    [2]: null, /* 'CLASH_2' */
    // $FlowIssue no computed
    [3]: null, /* 'REVOKED_3' */
    // $FlowIssue no computed
    [4]: metaUpgraded, /* 'UPGRADED_4' */
    // $FlowIssue no computed
    [5]: metaNew, /* 'NEW_5' */
    // $FlowIssue no computed
    [6]: null, /* 'REMOTE_FAIL_6' */
    // $FlowIssue no computed
    [7]: null, /* 'REMOTE_WORKING_7' */
    // $FlowIssue no computed
    [8]: null /* 'REMOTE_CHANGED_8' */
  }[diff]
}

function remoteProofToProof (rp: RemoteProof, lcr: ?LinkCheckResult): Proof {
  const proofState: SimpleProofState = lcr && proofStateToSimpleProofState(lcr.proofResult.state) || checking

  let proofType: string = ''
  if (rp.proofType === identify.ProofType.genericWebSite || rp.proofType === identify.ProofType.dns) {
    proofType = 'web'
  } else {
    proofType = mapTagToName(identify.ProofType, rp.proofType) || ''
  }

  let meta = trackDiffToSimpleProofMeta(0)
  if (lcr && lcr.diff && lcr.diff.type) {
    meta = trackDiffToSimpleProofMeta(lcr.diff.type)
  }

  return {
    state: proofState,
    id: rp.sigID,
    meta: meta,
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
