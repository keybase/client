import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import {bindActionCreators} from 'redux'
import PinentryRender from './index.render'
import * as actions from '../actions/pinentry'

export class Pinentry extends Component {
  render () {
    return <PinentryRender {...this.props} />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'pinentry'}}
  }
}

Pinentry.propTypes = PinentryRender.propTypes

export default connect(
  state => {
    return {
      // Mock out the RPC payload until implemented.
      payload: {
        windowTitle: 'Keybase',
        promptText: 'Please enter the Keybase passphrase for cjb (12+ characters)',
        features: {
          storeSecret: {
            value: true,
            respond: true,
            label: 'Store my passphrase for later use'
          },
          secondFeature: {
            value: false,
            label: 'Test a second checkbox'
          }
        }
      }
    }
  },
  dispatch => {
    return bindActionCreators(actions, dispatch)
  }
)(Pinentry)
