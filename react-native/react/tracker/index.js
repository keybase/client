'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import Render from './render'

import { navigateUp } from '../actions/router'

export default class Tracker extends BaseComponent {
  constructor (props: any) {
    super(props)

    // this is TEMP since we don't have a store yet
    this.state = {
      shouldFollowChecked: props.shouldFollow
    }
  }

  render () {
    // these non-prop values will be removed during integration
    return <Render {...this.props}
      shouldFollow={this.state.shouldFollowChecked}
      followChecked={checked => this.setState({shouldFollowChecked: checked})}
      />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Tracker',
        // dummy data TODO
        props: {
          reason: 'You accessed /private/cecile',
          state: currentPath.get('state'),
          username: 'test12',
          avatar: 'https://s3.amazonaws.com/keybase_processed_uploads/2571dc6108772dbe0816deef41b25705_200_200_square_200.jpeg',
          fullname: 'Alice Bonhomme-Biaias',
          followersCount: 81,
          followingCount: 567,
          followsYou: true,
          location: 'New York, NY',
          shouldFollow: true,
          onClose: () => {
            console.log('onClose')
            store.dispatch(navigateUp())
          }, // TODO
          onFollowHelp: () => window.open('https://keybase.io/docs/tracking'), // TODO
          onRefollow: () => {
            console.log('onRefollow')
            store.dispatch(navigateUp())
          },
          onUnfollow: () => {
            console.log('onUnfollow')
            store.dispatch(navigateUp())
          },
          proofs: [
            { platformIcon: '[TW]', platform: 'twitter', username: 'maxtaco', status: 'verified',
              meta: 'new', platformLink: 'http://www.twitter.com/maxtaco', proofLink: 'https://twitter.com/maxtaco/status/433688676975927296' },
            { platformIcon: '[GH]', platform: 'github', username: 'maxtaco', status: 'checking',
              meta: null, platformLink: 'http://www.github.com/maxtaco', proofLink: 'https://gist.github.com/maxtaco/8847250' },
            { platformIcon: '[re]', platform: 'reddit', username: 'maxtaco', status: 'unreachable',
              meta: null, platformLink: 'https://www.reddit.com/user/maxtaco', proofLink: 'https://www.reddit.com/r/KeybaseProofs/comments/2clf9c/my_keybase_proof_redditmaxtaco_keybasemax/' },
            { platformIcon: '[pgp]', platform: 'pgp', username: 'maxtaco', status: 'pending',
              meta: 'unreachable', platformLink: 'https://keybase.io/max/key.asc', proofLink: 'http://www.twitter.com/maxtaco' },
            { platformIcon: '[cb]', platform: 'coinbase', username: 'coinbase/maxtaco', status: 'deleted',
              meta: 'deleted', platformLink: 'https://www.coinbase.com/maxtaco', proofLink: 'https://www.coinbase.com/maxtaco/public-key' },
            { platformIcon: '[web]', platform: 'web', username: 'oneshallpass.com', status: 'verified',
              meta: null, httpsProofLink: 'https://oneshallpass.com/.well-known/keybase.txt', dnsProofLink: 'https://keybase.io/max/sigchain#0e577a1475085a07ad10663400de1cd7c321d2349cf2446de112e2f2f51a928b0f' },
            { platformIcon: '[web]', platform: 'web', username: 'somethingelse.com', status: 'verified',
              meta: 'pending', httpProofLink: 'http://oneshallpass.com/.well-known/keybase.txt', dnsProofLink: 'https://keybase.io/max/sigchain#0e577a1475085a07ad10663400de1cd7c321d2349cf2446de112e2f2f51a928b0f' }
          ]
          // TODO put back when we integrate
          // followChecked: checked => this.setState({shouldFollowChecked: checked})
        }
      }
    }
  }
}

Tracker.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}
