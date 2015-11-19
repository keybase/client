'use strict'
/* @flow */

// $FlowIssue with platform components
import React, {Component} from '../../base-react'
import Tracker from '../../tracker'

import engine from '../../engine'
import { createServer } from '../../engine/server'
import { flattenCallMap, promisifyResponses } from '../../engine/call-map-middleware'

import * as _ from 'lodash'

import { identify } from '../../keybase_v1.js'
import { normal, warning, error, pending } from '../../tracker/common-types'

import type {IdentifyKey, TrackSummary, Identity, RemoteProof, LinkCheckResult, Cryptocurrency, IdentifyOutcome, User, UserSummary, ProofState} from '../../constants/types/flow-types'


import type { BioProps } from '../../tracker/bio.render.desktop'
import type { ActionProps } from '../../tracker/action.render.desktop'
import type { HeaderProps } from '../../tracker/header.render.desktop'
import type { ProofsProps, Proof } from '../../tracker/proofs.render.desktop'
import type { TrackerProps } from '../../tracker/render.desktop'
import type { SimpleProofState } from '../../tracker/common-types'

type ComponentState = {
  outstandingReqs: Array<RemoteProof>,
  overallProofStatus: SimpleProofState,
  bioProps: BioProps,
  actionProps: ActionProps,
  headerProps: HeaderProps,
  proofsProps: ProofsProps
}

export default class TrackerPopupListener extends Component {

  // TODO's
  // * Get reason from the service
  // * Get UserInfo (for BioProps)
  //

  state: ComponentState;

  // Get some type safety here
  setState (object: ComponentState): void {
    super.setState(object)
  }

  constructor (props: {}) {
    super(props)
    const overallProofStatus = 'pending'
    this.state = {
      outstandingReqs: [],
      overallProofStatus,
      bioProps: {
        username: null,
        state: overallProofStatus,
        userInfo: {
          fullname: 'TODO: get this information',
          followersCount: -1,
          followingCount: -1,
          followsYou: false,
          avatar: 'TODO: get this information',
          location: 'TODO: get this information'
        }
      },

      actionProps: {
        state: overallProofStatus,
        username: null,
        shouldFollow: true,
        onClose: () => {
          console.log('onClose')
        }, // TODO
        onRefollow: () => {
          console.log('onRefollow')
        },
        onUnfollow: () => {
          console.log('onUnfollow')
        },
        onFollowHelp: () => window.open('https://keybase.io/docs/tracking'), // TODO
          // followChecked: checked => this.setState({shouldFollowChecked: checked})
        followChecked: checked => console.log('follow checked:', checked)
      },

      headerProps: {
        reason: 'TODO: get this information',
        onClose: () => {
          // TODO
          console.log('onClose from header')
        }
      },

      proofsProps: {
        proofs: []
      }
    }
  }

  mapTagToName (obj: any, tag: any): ?string {
    return Object.keys(obj).filter(x => obj[x] === tag)[0]
  }

  stateToColor (state: SimpleProofState): string {
    if (state === normal) {
      return 'green'
    } else if (state === warning) {
      return 'yellow'
    } else if (state === error) {
      return 'red'
    }

    return 'gray'
  }

  proofStatusToSimpleProofState (proofState: ProofState): SimpleProofState {
    const statusName: ?string = this.mapTagToName(identify.ProofState, proofState)
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

  remoteProofToProof (rp: RemoteProof, lcr: ?LinkCheckResult): Proof {
    const proofStatus: SimpleProofState = lcr && this.proofStatusToSimpleProofState(lcr.proofResult.state) || pending

    let proofType: string = ''
    if (rp.proofType === identify.ProofType.genericWebSite || rp.proofType === identify.ProofType.dns) {
      proofType = 'web'
    } else {
      proofType = this.mapTagToName(identify.ProofType, rp.proofType) || ''
    }

    return {
      state: proofStatus,
      id: rp.sigID,
      type: proofType,
      color: this.stateToColor(proofStatus),
      name: rp.displayMarkup,
      humanUrl: (lcr && lcr.hint && lcr.hint.humanUrl)
    }
  }

  updateProofsAndChecks (rp: RemoteProof, lcr: LinkCheckResult): void {
    const oldProofs = this.state.proofsProps.proofs
    const proofs = oldProofs.map(proof => {
      if (proof.id === rp.sigID) {
        return this.remoteProofToProof(rp, lcr)
      }
      return proof
    })
    this.setState({
      ...this.state,
      proofsProps: {
        proofs
      }
    })
  }

  updateOverallProofStatus (proofs: Array<Proof>): void {
    const allOk: boolean = proofs.reduce((acc, p) => acc && p.state === normal, true)

    const anyWarnings: boolean = proofs.reduce((acc, p) => acc || p.state === warning, true)

    const anyError: boolean = proofs.reduce((acc, p) => acc || p.state === error, false)

    const anyPending: boolean = proofs.reduce((acc, p) => acc || p.state === pending, false)

    let overallProofStatus: SimpleProofState = 'error'

    if (allOk) {
      overallProofStatus = 'normal'
    } else if (anyWarnings) {
      overallProofStatus = 'warning'
    } else if (anyError) {
      overallProofStatus = 'error'
    } else if (anyPending) {
      overallProofStatus = 'pending'
    }

    this.setState({
      ...this.state,
      overallProofStatus,
      bioProps: {
        ...this.state.bioProps,
        state: overallProofStatus
      },
      actionProps: {
        ...this.state.actionProps,
        state: overallProofStatus
      }
    })
  }

  componentWillMount () {
    // TODO Move this to where we spawn a new window for tracker popups
    engine.rpc('delegateUiCtl.registerIdentifyUI', {}, {}, (error, response) => {
      if (error != null) {
        console.error('error in registering identify ui: ', error)
      } else {
        console.log('Registered identify ui')
      }
    })

    const serverCallMapFn = params => {
      const loadUserInfo = uid => {
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

          console.log('Got back user Summary: ', onlyUser)

          this.setState({
            ...this.state,
            bioProps: {
              ...this.state.bioProps,
              userInfo: {
                fullname: onlyUser.fullName,
                avatar: onlyUser.thumbnail,
                location: 'TODO: get location data',
                // TODO: get this data from somewhere
                followersCount: -1,
                followingCount: -1,
                followsYou: false
              }
            }

          })
          onlyUser.thumbnail
        })
      }

      // setup the callmap
      const identifyUi = {
        start: (params: {sessionID: number, username: string}) => {
          const {username} = params
          this.setState({
            ...this.state,
            bioProps: {
              ...this.state.bioProps,
              username
            },
            actionProps: {
              ...this.state.actionProps,
              username
            }
          })
          console.log('starting identify ui server instance')
        },
        displayKey: (params: {sessionID: number, key: IdentifyKey}) => {
          console.log('displaying key', params)
        },
        reportLastTrack: (params: {sessionID: number, track: ?TrackSummary}) => {
          console.log('Report last track', params)
        },

        launchNetworkChecks: (params: {sessionID: number, identity: Identity, user: User}) => {
          console.log('launch network checks', params)
          // This is the first spot that we have access to the user, so let's use that to get
          // The user information
          loadUserInfo(params.user.uid)

          const proofs: Array<Proof> = params.identity.proofs.map(rp => this.remoteProofToProof(rp.proof))
          this.setState({
            ...this.state,
            proofsProps: {
              proofs
            }})
        },

        displayTrackStatement: (params: {sessionID: number, stmt: string}) => {
          console.log('display track statements', params)
        },

        finishWebProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
          this.updateProofsAndChecks(params.rp, params.lcr)
          console.log('finish web proof', params)
        },
        finishSocialProofCheck: (params: {sessionID: number, rp: RemoteProof, lcr: LinkCheckResult}) => {
          this.updateProofsAndChecks(params.rp, params.lcr)
          console.log('finish social proof', params)
        },
        displayCryptocurrency: (params: {sessionID: number, c: Cryptocurrency}) => {
          console.log('finish displayCryptocurrency', params)
        },
        reportTrackToken: (params: {sessionID: number, trackToken: string}) => {
          console.log('finish report track token', params)
        },
        confirm: (params: {sessionID: number, outcome: IdentifyOutcome}): bool => {
          console.log('confirm', params)
          return false
        },
        finish: (params: {sessionID: number}) => {
          // Check if there were any errors in the proofs
          this.updateOverallProofStatus(this.state.proofsProps.proofs)
          console.log('finish', params)
        }
      }

      return promisifyResponses(flattenCallMap({ keybase: { '1': { identifyUi } } }))
    }

    createServer(
      engine,
      'keybase.1.identifyUi.delegateIdentifyUI',
      'keybase.1.identifyUi.finish',
      serverCallMapFn
    )
  }

  render (): ReactElement {
    const trackerProps: TrackerProps = {
      headerProps: this.state.headerProps,
      bioProps: this.state.bioProps,
      proofsProps: this.state.proofsProps,
      actionProps: this.state.actionProps
    }

    return <Tracker {...trackerProps}/>
  }
}
