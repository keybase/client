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
          }
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
