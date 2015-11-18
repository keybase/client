'use strict'

import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import Render from './render'
import {navigateUp} from '../actions/router'

class Tracker extends Component {
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

  static parseRoute (currentPath) {
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
          platformProofs: [
            { platform: {icon: '[TW]', name: 'twitter', username: 'maxtaco', uri: 'http://www.twitter.com/maxtaco'},
              proof: {title: 'tweet', proof: 'https://twitter.com/maxtaco/status/433688676975927296', status: 'verified', meta: 'new'} },
            { platform: { icon: '[GH]', name: 'github', username: 'maxtaco', uri: 'http://www.github.com/maxtaco' },
              proof: {title: 'gist', proof: 'https://gist.github.com/maxtaco/8847250', status: 'checking', meta: null} },
            { platform: {icon: '[re]', name: 'reddit', username: 'maxtaco', uri: 'https://www.reddit.com/user/maxtaco'},
              proof: {title: 'post', proof: 'https://www.reddit.com/r/KeybaseProofs/comments/2clf9c/my_keybase_proof_redditmaxtaco_keybasemax/', status: 'unreachable', meta: null} },
            { platform: {icon: '[pgp]', name: 'pgp', username: 'maxtaco', uri: 'https://keybase.io/max/key.asc'},
              proof: {title: 'PGP Key', proof: 'http://www.twitter.com/maxtaco', status: 'pending', meta: 'unreachable'} },
            { platform: {icon: '[cb]', name: 'coinbase', username: 'coinbase/maxtaco', uri: 'https://www.coinbase.com/maxtaco'},
              proof: {title: 'post', proof: 'https://www.coinbase.com/maxtaco/public-key', status: 'deleted', meta: 'deleted'} },
            { platform: {icon: '[web]', name: 'web', uri: 'oneshallpass.com'},
              proof: {title: 'File', proof: 'https://oneshallpass.com/.well-known/keybase.txt', status: 'verified', meta: null} },
            { platform: {icon: '[web]', name: 'web', uri: 'oneshallpass.com'},
              proof: {title: 'DNS', proof: 'https://keybase.io/max/sigchain#0e577a1475085a07ad10663400de1cd7c321d2349cf2446de112e2f2f51a928b0f', status: 'verified', meta: null} },
            { platform: {icon: '[web]', name: 'web', uri: 'somethingelse.com'},
              proof: {title: 'File', proof: 'http://oneshallpass.com/.well-known/keybase.txt', status: 'verified', meta: 'pending'} }
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

export default connect(
  null,
  dispatch => {
    return {
      onClose: () => {
        console.log('onClose')
        dispatch(navigateUp())
      }, // TODO
      onFollowHelp: () => window.open('https://keybase.io/docs/tracking'), // TODO
      onRefollow: () => {
        console.log('onRefollow')
        dispatch(navigateUp())
      },
      onUnfollow: () => {
        console.log('onUnfollow')
        dispatch(navigateUp())
      }
    }
  }
)(Tracker)
