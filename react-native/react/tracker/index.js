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
          state: 'warning',
          username: 'test12',
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
