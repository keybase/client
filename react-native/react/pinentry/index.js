'use strict'

import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import PinentryRender from './pinentry.render'

class Pinentry extends Component {
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
      onSubmit: (passphrase, features) => {
        console.log(`Passphrase submitted: ${passphrase}`)
        console.log(features)
      },
      onCancel: () => console.log('Pinentry dialog canceled'),
      // Mock out the RPC payload until implemented.
      payload: {
        windowTitle: 'Keybase',
        promptText: 'Please enter the Keybase passphrase for cjb (12+ characters)',
        features: {
          secretStorage: {
            value: true,
            label: 'Store my passphrase for later use'
          },
          secondFeature: {
            value: false,
            label: 'Test a second checkbox'
          }
        }
      }
    }
  }
)(Pinentry)
