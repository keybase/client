'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
// $FlowIssue base-redux
import {connect} from '../base-redux'
// $FlowIssue platform dependent files
import Render from './render'
import {navigateUp} from '../actions/router'

import type {BioProps} from './bio.render.desktop'
import type {ActionProps} from './action.render.desktop'
import type {HeaderProps} from './header.render.desktop'
import type {ProofsProps} from './proofs.render.desktop'
import type {User} from '../constants/types/flow-types'

class Tracker extends Component {

  render () {
    // these non-prop values will be removed during integration
    return <Render
             bioProps={this.props.bioProps}
             headerProps={this.props.headerProps}
             actionProps={this.props.actionProps}
             proofsProps={this.props.proofsProps}/>
  }

  static parseRoute (currentPath) {
    return {
      componentAtTop: {
        title: 'Tracker',
        props: {
          state: currentPath.get('state'),
          dummyData: true
        }
      }
    }
  }
}

Tracker.propTypes = {
  bioProps: React.PropTypes.any.isRequired,
  headerProps: React.PropTypes.any.isRequired,
  actionProps: React.PropTypes.any.isRequired,
  proofsProps: React.PropTypes.any.isRequired
}

export default connect(
  null,
  dispatch => {
    const user: User = {
      uid: {},
      username: 'test123'
    }

    const bioProps: BioProps = {
      username: user.username,
      state: 'pending',
      userInfo: {
        fullname: 'Alice Bonhomme-Biaias',
        followersCount: 81,
        followingCount: 567,
        followsYou: true,
        location: 'New York, NY',
        avatar: 'https://s3.amazonaws.com/keybase_processed_uploads/2571dc6108772dbe0816deef41b25705_200_200_square_200.jpeg'
      }
    }

    const actionProps: ActionProps = {
      state: 'pending',
      username: user.username,
      shouldFollow: true,
      onClose: () => {
        console.log('onClose')
        dispatch(navigateUp())
      }, // TODO
      onRefollow: () => {
        console.log('onRefollow')
        dispatch(navigateUp())
      },
      onUnfollow: () => {
        console.log('onUnfollow')
        dispatch(navigateUp())
      },
      onFollowHelp: () => window.open('https://keybase.io/docs/tracking'), // TODO
      // followChecked: checked => this.setState({shouldFollowChecked: checked})
      followChecked: checked => console.log('follow checked:', checked)
    }

    const headerProps: HeaderProps = {
      reason: 'You accessed /private/cecile',
      onClose: () => {
        console.log('onClose')
        dispatch(navigateUp())
      }
    }

    const proofsProps: ProofsProps = {
      proofs: [
        {"name":"marcopolo","type":"github","id":"56363c0307325cb4eedb072be7f8a5d3b29d13f5ef33650a7e910f772ff1d3710f", state: 'normal', humanUrl: "github.com/marcopolo", color: 'green'}, //eslint-disable-line
        {"name":"open_sourcery","type":"twitter","id":"76363c0307325cb4eedb072be7f8a5d3b29d13f5ef33650a7e910f772ff1d3710f", state: 'pending', humanUrl: "twitter.com/open_sourcery", color: 'gray'}, //eslint-disable-line
      ]
    }

    return {
      bioProps,
      actionProps,
      headerProps,
      proofsProps
    }
  },
  (stateProps, dispatchProps, ownProps) => {
    if (ownProps.dummyData) {
      const state = ownProps.state
      dispatchProps.actionProps.state = state
      dispatchProps.bioProps.state = state
      return dispatchProps
    }

    return ownProps
  }

)(Tracker)
